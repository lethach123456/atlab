<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/warranty.php';

use Unc\Warranty\SourceIndexCache;
use function Unc\Warranty\cacheDirectory;
use function Unc\Warranty\cacheTtl;
use function Unc\Warranty\prepareCacheDirectory;

$arguments = array_slice($argv, 1);
if ($arguments !== [] && $arguments !== ['--loop'] && $arguments !== ['--once']) {
    fwrite(STDERR, "Usage: php backend/refresh.php [--loop|--once]\n");
    exit(1);
}
$loop = $arguments === ['--loop'];
if (cacheTtl() === 0) {
    fwrite(STDOUT, "[Warranty] Bộ nhớ đệm đang tắt; bỏ qua cập nhật ngầm.\n");
    exit;
}
$directory = cacheDirectory();
if (!prepareCacheDirectory($directory) || is_link($directory . '/worker.lock')) {
    fwrite(STDERR, "[Warranty] Không mở được thư mục cập nhật dữ liệu.\n");
    exit(1);
}

// A second launcher or cron invocation must not create another refresh loop.
$lease = @fopen($directory . '/worker.lock', 'c');
if ($lease === false || !@chmod($directory . '/worker.lock', 0600)) {
    if (is_resource($lease)) fclose($lease);
    fwrite(STDERR, "[Warranty] Không tạo được khóa cập nhật dữ liệu.\n");
    exit(1);
}
if (!flock($lease, LOCK_EX | LOCK_NB)) {
    fclose($lease);
    fwrite(STDOUT, "[Warranty] Đã có tiến trình cập nhật dữ liệu đang chạy.\n");
    exit(2);
}

$cache = new SourceIndexCache($directory, cacheTtl());
$exitCode = 0;
try {
    do {
        $started = hrtime(true);
        try {
            $updated = $cache->refresh();
            $exitCode = $updated ? 0 : 1;
            fwrite($updated ? STDOUT : STDERR, $updated
                ? "[Warranty] Đã cập nhật dữ liệu bảo hành.\n"
                : "[Warranty] Bỏ qua lượt cập nhật: bộ nhớ đệm đang bận hoặc chưa ghi được.\n");
        } catch (Throwable $exception) {
            $exitCode = 1;
            // Only operational state is logged; no patient data, source body or codes.
            fwrite(STDERR, "[Warranty] Chưa tải được nguồn dữ liệu; sẽ thử lại ở lượt tiếp theo.\n");
        }
        if ($loop) {
            $remainingMicroseconds = max(0, 60_000_000 - (int) ((hrtime(true) - $started) / 1000));
            usleep($remainingMicroseconds);
        }
    } while ($loop);
} finally {
    flock($lease, LOCK_UN);
    fclose($lease);
}
exit($exitCode);
