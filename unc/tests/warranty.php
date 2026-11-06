<?php
declare(strict_types=1);

require_once __DIR__ . '/../backend/warranty.php';

use Unc\Warranty\SourceException;
use Unc\Warranty\ValidationException;
use function Unc\Warranty\decodeRows;
use function Unc\Warranty\formatTreatmentDate;
use function Unc\Warranty\handleRequest;
use function Unc\Warranty\lookup;

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$checks = 0;
function verify(bool $condition, string $label): void
{
    global $checks;
    $checks++;
    if (!$condition) {
        throw new RuntimeException('Failed: ' . $label);
    }
}
function expectException(string $class, callable $action, string $label): void
{
    try {
        $action();
    } catch (Throwable $exception) {
        verify($exception instanceof $class, $label);
        return;
    }
    verify(false, $label);
}
function fixture(array $rows): callable
{
    return static fn(): string => json_encode(['content' => $rows], JSON_THROW_ON_ERROR);
}

// Synthetic records only. No production data or real warranty codes belong here.
$row = ['001-TEST', '<img src=x onerror=alert(1)>', '0900000000', 'Phòng khám mẫu', 'Địa chỉ kiểm thử', 'Everest', '15 năm', '2024-08-16T20:00:00.000Z', '13-23', 'private note'];
$found = lookup(['code' => ' 001-TEST ', 'agree' => '1'], fixture([[''], $row]));
verify($found['status'] === 'found', 'find a record after an empty first row');
verify($found['record']['warrantyCode'] === '001-TEST', 'trim surrounding code whitespace');
verify($found['record']['customerName'] === $row[1], 'preserve source text without interpreting HTML');
verify($found['record']['phone'] === '0900000000', 'preserve phone leading zero');
verify($found['record']['address'] === $row[4], 'map address from column E');
verify($found['record']['laboratory'] === 'AT Dental Lab', 'use the default fabrication laboratory');
verify($found['record']['treatmentDate'] === '17/08/2024', 'convert UTC date into Vietnam timezone');
verify($found['record']['toothPosition'] === '13-23', 'preserve tooth positions');
verify($found['record']['origin'] === 'Hàn Quốc', 'use established origin');
verify(count($found['record']) === 11 && !isset($found['record']['note']) && !isset($found['record']['birthday']), 'expose only documented public fields');
verify(lookup(['code' => '1-TEST', 'agree' => '1'], fixture([$row]))['status'] === 'not_found', 'do not strip code leading zeros');
verify(lookup(['code' => 'TEST', 'agree' => '1'], fixture([$row]))['status'] === 'not_found', 'reject partial code matches');
verify(lookup(['code' => '001-test', 'agree' => '1'], fixture([$row]))['status'] === 'not_found', 'preserve exact case matching');
verify(lookup(['code' => '001-TEST', 'agree' => '1'], fixture([['another', '001-TEST']]))['status'] === 'not_found', 'match only the code column');
verify(lookup(['mabaohanh' => '001-TEST', 'agree' => '1'], fixture([$row]))['status'] === 'found', 'accept the old field name');

$sparse = lookup(['code' => 'SPARSE', 'agree' => '1'], fixture([['SPARSE', null]]));
verify($sparse['record']['customerName'] === '' && $sparse['record']['clinic'] === '' && $sparse['record']['treatmentDate'] === '', 'handle null and missing cells');
verify($sparse['record']['address'] === '' && $sparse['record']['laboratory'] === 'AT Dental Lab', 'keep default laboratory when optional source cells are missing');
verify(formatTreatmentDate('17/08/2024') === '17/08/2024', 'preserve an already formatted date');
verify(formatTreatmentDate('2024-08-17') === '17/08/2024', 'format an ISO date without a timezone');
verify(formatTreatmentDate('2024-02-30') === '2024-02-30', 'do not invent a date for invalid source text');
verify(formatTreatmentDate('unknown') === 'unknown', 'preserve unknown date text');

$neverFetch = static function (): string { throw new RuntimeException('Validation must precede fetching'); };
foreach ([[], ['code' => '  ', 'agree' => '1'], ['code' => [], 'agree' => '1'], ['code' => "A\0B", 'agree' => '1'], ['code' => str_repeat('A', 129), 'agree' => '1'], ['code' => '001-TEST'], ['code' => '001-TEST', 'agree' => '0']] as $invalid) {
    expectException(ValidationException::class, static fn() => lookup($invalid, $neverFetch), 'validate before upstream access');
}
foreach (['<html>upstream error</html>', '{invalid', '{}', '[]', '{"content":{}}', '{"content":[{}]}', '{"content":null}', '{"content":"wrong"}', '{"content":["wrong"]}', '{"content":{"row":[]}}'] as $malformed) {
    expectException(SourceException::class, static fn() => decodeRows($malformed), 'reject malformed source data');
}
expectException(SourceException::class, static fn() => decodeRows(str_repeat(' ', Unc\Warranty\MAX_SOURCE_BYTES + 1)), 'bound source response size');
expectException(SourceException::class, static fn() => lookup(['code' => '001-TEST', 'agree' => '1'], static fn() => []), 'reject a non-JSON loader result');
expectException(SourceException::class, static fn() => lookup(['code' => 'BAD', 'agree' => '1'], fixture([['BAD', ['nested']]])), 'reject invalid matched cell types');
expectException(SourceException::class, static fn() => lookup(['code' => '001-TEST', 'agree' => '1'], static function (): string { throw new SourceException('upstream unavailable'); }), 'propagate upstream failure without a fake result');
verify(lookup(['code' => 'NONE', 'agree' => '1'], fixture([]))['status'] === 'not_found', 'handle an empty sheet');

verify(handleRequest('GET', [], $neverFetch)['httpStatus'] === 405, 'reject unsupported methods before fetching');
verify(handleRequest('POST', [], $neverFetch)['httpStatus'] === 422, 'map validation to HTTP 422');
verify(handleRequest('POST', ['code' => 'TEST', 'agree' => '1'], static fn(): string => '<html>error</html>')['httpStatus'] === 502, 'map source errors to HTTP 502');
verify(handleRequest('POST', ['code' => '001-TEST', 'agree' => '1'], fixture([$row]))['httpStatus'] === 200, 'map a valid lookup to HTTP 200');

echo "Warranty checks passed: {$checks}\n";
