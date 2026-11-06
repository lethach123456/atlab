<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function respond(int $status, array $body): void { http_response_code($status); echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { header('Allow: GET'); respond(405, ['error'=>'method_not_allowed']); }
$code = $_GET['code'] ?? '';
if (!is_string($code) || !preg_match('/^[A-Za-z0-9_-]{1,64}$/D', trim($code))) respond(400, ['error'=>'invalid_code']);
const DEFAULT_WARRANTY_API_URL = 'https://us-central1-gen-lang-client-0851537597.cloudfunctions.net/lookupWarranty';
const DEFAULT_WARRANTY_API_KEY = '';
$key = getenv('WARRANTY_API_KEY') ?: ($_SERVER['WARRANTY_API_KEY'] ?? $_ENV['WARRANTY_API_KEY'] ?? DEFAULT_WARRANTY_API_KEY);
$url = getenv('WARRANTY_API_URL') ?: ($_SERVER['WARRANTY_API_URL'] ?? $_ENV['WARRANTY_API_URL'] ?? DEFAULT_WARRANTY_API_URL);
if (!$key || !$url || !preg_match('~^https://[a-z0-9-]+\.cloudfunctions\.net/lookupWarranty$~D', $url) || !function_exists('curl_init')) respond(503, ['error'=>'unavailable']);
$ch = curl_init($url.'?code='.rawurlencode(strtoupper(trim($code))));
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>['Accept: application/json', 'x-api-key: '.$key], CURLOPT_CONNECTTIMEOUT=>5, CURLOPT_TIMEOUT=>15, CURLOPT_FOLLOWLOCATION=>false, CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS]);
$body = curl_exec($ch); $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
if ($body === false) respond(503, ['error'=>'unavailable']);
$data = json_decode($body, true);
if ($status !== 200 || !is_array($data)) respond(in_array($status, [400,404,409], true) ? $status : 503, ['error'=>'unavailable']);
// The public page shows the warranty fields only, not internal pricing or contact data.
$details = [];
foreach (($data['restorations'] ?? []) as $row) {
  if (!is_array($row)) continue;
  $details[] = array_intersect_key($row, array_flip(['material','teeth','orderDate','warrantyPeriod']));
}
respond(200, ['warrantyCode'=>$data['warrantyCode'] ?? '', 'patientName'=>$data['patientName'] ?? '', 'clinicName'=>$data['clinicName'] ?? '', 'teeth'=>$data['teeth'] ?? '', 'restorations'=>$details]);
