<?php
declare(strict_types=1);

namespace Unc\Warranty;

use DateTimeImmutable;
use DateTimeZone;
use JsonException;
use RuntimeException;

const SOURCE_URL = 'https://script.google.com/macros/s/AKfycbyXrdHpw6onjYRHJURhCMMNyC_Kpwh9ZRKUwb0MjDTBEeWMNlsS8wBjFCzuh32gm0k4Hg/exec';
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const SOURCE_ERROR_MESSAGE = 'Không thể tải dữ liệu bảo hành. Vui lòng thử lại sau.';

final class ValidationException extends RuntimeException {}
final class SourceException extends RuntimeException {}

require_once __DIR__ . '/cache.php';

const DEFAULT_WARRANTY_API_URL = 'https://us-central1-gen-lang-client-0851537597.cloudfunctions.net/lookupWarranty';
const DEFAULT_WARRANTY_API_KEY = '';

/** Fetch a single warranty record through the AT Dental server API. */
function lookupFirebase(string $code): ?array
{
    $key = getenv('WARRANTY_API_KEY') ?: ($_SERVER['WARRANTY_API_KEY'] ?? $_ENV['WARRANTY_API_KEY'] ?? DEFAULT_WARRANTY_API_KEY);
    $url = getenv('WARRANTY_API_URL') ?: ($_SERVER['WARRANTY_API_URL'] ?? $_ENV['WARRANTY_API_URL'] ?? DEFAULT_WARRANTY_API_URL);
    if (!$key || !$url || !preg_match('~^https://[a-z0-9-]+\.cloudfunctions\.net/lookupWarranty$~D', $url) || !function_exists('curl_init')) {
        throw new SourceException(SOURCE_ERROR_MESSAGE);
    }
    $handle = curl_init($url . '?code=' . rawurlencode(strtoupper($code)));
    curl_setopt_array($handle, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => ['Accept: application/json', 'x-api-key: ' . $key], CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 20, CURLOPT_FOLLOWLOCATION => false, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS]);
    $body = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);
    if ($status === 404) return null;
    if ($status !== 200 || !is_string($body) || strlen($body) > MAX_SOURCE_BYTES) throw new SourceException(SOURCE_ERROR_MESSAGE);
    try { $data = json_decode($body, true, 64, JSON_THROW_ON_ERROR); } catch (JsonException $e) { throw new SourceException(SOURCE_ERROR_MESSAGE); }
    if (!is_array($data) || !is_array($data['restorations'] ?? null)) throw new SourceException(SOURCE_ERROR_MESSAGE);
    $unique = static function (string $field) use ($data): string {
        $values = [];
        foreach ($data['restorations'] as $row) {
            $value = is_array($row) && is_string($row[$field] ?? null) ? trim($row[$field]) : '';
            if ($value !== '' && !in_array($value, $values, true)) $values[] = $value;
        }
        return implode(', ', $values);
    };
    $text = static fn(string $field): string => is_string($data[$field] ?? null) ? $data[$field] : '';
    return [
        'warrantyCode' => $text('warrantyCode'), 'customerName' => $text('patientName'),
        'phone' => $text('phone'), 'clinic' => $text('clinicName'), 'address' => $text('clinicAddress'),
        'material' => $unique('material'), 'warrantyPeriod' => $unique('warrantyPeriod'),
        'treatmentDate' => $unique('orderDate'), 'toothPosition' => $text('teeth'),
        'laboratory' => 'AT Dental Lab', 'origin' => 'HÀN QUỐC',
    ];
}

/** Only this server-side function retrieves the complete source sheet. */
function fetchSource(): string
{
    if (!function_exists('curl_init')) {
        throw new SourceException(SOURCE_ERROR_MESSAGE);
    }

    $handle = curl_init(SOURCE_URL);
    if ($handle === false) {
        throw new SourceException(SOURCE_ERROR_MESSAGE);
    }

    $body = '';
    curl_setopt_array($handle, [
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_USERAGENT => 'UNC-Warranty-Lookup/1.0',
        CURLOPT_WRITEFUNCTION => static function ($curl, string $chunk) use (&$body): int {
            if (strlen($body) + strlen($chunk) > MAX_SOURCE_BYTES) {
                return 0;
            }
            $body .= $chunk;
            return strlen($chunk);
        },
    ]);

    $success = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);
    if ($success === false || $status < 200 || $status >= 300) {
        throw new SourceException(SOURCE_ERROR_MESSAGE);
    }
    return $body;
}

/** @return list<array> */
function decodeRows(string $json): array
{
    if (strlen($json) > MAX_SOURCE_BYTES) {
        throw new SourceException(SOURCE_ERROR_MESSAGE);
    }
    try {
        $decoded = json_decode($json, false, 64, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        throw new SourceException(SOURCE_ERROR_MESSAGE);
    }
    if (!$decoded instanceof \stdClass || !isset($decoded->content) || !is_array($decoded->content)) {
        throw new SourceException(SOURCE_ERROR_MESSAGE);
    }
    foreach ($decoded->content as $row) {
        if (!is_array($row) || !array_is_list($row)) {
            throw new SourceException(SOURCE_ERROR_MESSAGE);
        }
    }
    return $decoded->content;
}

function cellText(array $row, int $column): string
{
    $value = $row[$column] ?? null;
    if ($value === null) {
        return '';
    }
    if (!is_string($value) && !is_int($value) && !is_float($value)) {
        throw new SourceException(SOURCE_ERROR_MESSAGE);
    }
    return trim((string) $value);
}

function formatTreatmentDate(string $date): string
{
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/D', $date, $parts)) {
        return $date;
    }
    if (!checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1])) {
        return $date;
    }
    try {
        $timezone = new DateTimeZone('Asia/Ho_Chi_Minh');
        return (new DateTimeImmutable($date, $timezone))->setTimezone($timezone)->format('d/m/Y');
    } catch (\Exception $exception) {
        return $date;
    }
}

/** @return array<string,string>|null */
function findRecord(array $rows, string $code): ?array
{
    foreach ($rows as $row) {
        $rowCode = cellText($row, 0);
        if ($rowCode === '' || $rowCode !== $code) {
            continue;
        }
        return [
            'warrantyCode' => $rowCode,
            'customerName' => cellText($row, 1),
            'phone' => cellText($row, 2), // C
            'clinic' => cellText($row, 3),
            'address' => cellText($row, 4), // E
            'material' => cellText($row, 5),
            'warrantyPeriod' => cellText($row, 6),
            'treatmentDate' => formatTreatmentDate(cellText($row, 7)),
            'toothPosition' => cellText($row, 8), // I
            'laboratory' => 'AT Dental Lab',
            'origin' => 'Hàn Quốc',
        ];
    }
    return null;
}

/** The optional loader allows isolated tests without network or patient fixtures. */
function lookup(array $input, ?callable $loadSource = null): array
{
    $value = $input['code'] ?? $input['mabaohanh'] ?? null;
    if (!is_string($value) || trim($value) === '') {
        throw new ValidationException('Vui lòng nhập mã bảo hành.');
    }
    $code = trim($value);
    if (strlen($code) > 128 || preg_match('/[\x00-\x1F\x7F]/', $code)) {
        throw new ValidationException('Mã bảo hành không hợp lệ.');
    }
    if (($input['agree'] ?? null) !== '1') {
        throw new ValidationException('Vui lòng xác nhận để tiếp tục.');
    }

    if ($loadSource === null) {
        $record = lookupFirebase($code);
    } else {
        // Fixture loaders stay isolated from the shared production snapshot.
        $json = $loadSource();
        if (!is_string($json)) {
            throw new SourceException(SOURCE_ERROR_MESSAGE);
        }
        $record = findRecord(decodeRows($json), $code);
    }
    if ($record === null) {
        return [
            'status' => 'not_found',
            'message' => 'Không tìm thấy mã bảo hành. Vui lòng kiểm tra lại mã thẻ.',
        ];
    }
    return ['status' => 'found', 'record' => $record];
}

/** No fixture controls are exposed through HTTP; tests can inject a loader in PHP. */
function handleRequest(string $method, array $input, ?callable $loadSource = null): array
{
    if ($method !== 'POST') {
        return [
            'httpStatus' => 405,
            'headers' => ['Allow' => 'POST'],
            'body' => ['status' => 'error', 'message' => 'Vui lòng sử dụng biểu mẫu tra cứu.'],
        ];
    }
    try {
        return ['httpStatus' => 200, 'body' => lookup($input, $loadSource)];
    } catch (ValidationException $exception) {
        return ['httpStatus' => 422, 'body' => ['status' => 'error', 'message' => $exception->getMessage()]];
    } catch (SourceException $exception) {
        return ['httpStatus' => 502, 'body' => ['status' => 'error', 'message' => SOURCE_ERROR_MESSAGE]];
    } catch (\Throwable $exception) {
        return ['httpStatus' => 500, 'body' => ['status' => 'error', 'message' => 'Không thể tra cứu lúc này. Vui lòng thử lại sau.']];
    }
}

function sendResponse(array $response): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    http_response_code($response['httpStatus']);
    foreach ($response['headers'] ?? [] as $name => $value) {
        header($name . ': ' . $value);
    }
    echo json_encode($response['body'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_INVALID_UTF8_SUBSTITUTE);
}
