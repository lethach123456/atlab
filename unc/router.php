<?php
declare(strict_types=1);

// Router for PHP's development server. Only these public paths are served.
$pathname = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
if (str_starts_with($pathname, '/kiem-tra-chung-nhan-xuat-xu/')) {
    $subpath = substr($pathname, strlen('/kiem-tra-chung-nhan-xuat-xu'));
    if ($subpath === '/data.php' || str_starts_with($subpath, '/assets/')) {
        $pathname = $subpath;
    }
}

if (in_array($pathname, ['/', '/index.html', '/kiem-tra-chung-nhan-xuat-xu', '/kiem-tra-chung-nhan-xuat-xu/'], true)) {
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache');
    header('X-Content-Type-Options: nosniff');
    readfile(__DIR__ . '/index.html');
    return true;
}

if ($pathname === '/data.php') {
    require __DIR__ . '/data.php';
    return true;
}

if (str_starts_with($pathname, '/assets/') && !str_contains($pathname, "\0")) {
    $filename = realpath(__DIR__ . $pathname);
    $assets = realpath(__DIR__ . '/assets');
    $extension = strtolower(pathinfo($filename ?: '', PATHINFO_EXTENSION));
    if ($filename !== false && $assets !== false && str_starts_with($filename, $assets . DIRECTORY_SEPARATOR)
        && is_file($filename) && in_array($extension, ['css', 'js', 'ttf', 'woff', 'woff2', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'avif'], true)) {
        return false;
    }
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
header('X-Content-Type-Options: nosniff');
echo 'Not found';
return true;
