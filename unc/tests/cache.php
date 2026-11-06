<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../backend/warranty.php';
require_once __DIR__ . '/../backend/cache.php';

use Unc\Warranty\SourceException;
use Unc\Warranty\SourceIndexCache;

$checks = 0;
function cacheVerify(bool $condition, string $label): void
{
    global $checks;
    $checks++;
    if (!$condition) {
        throw new RuntimeException('Failed: ' . $label);
    }
}

function cacheExpectSourceError(callable $operation, string $label): void
{
    try {
        $operation();
    } catch (SourceException $exception) {
        cacheVerify(true, $label);
        return;
    }
    cacheVerify(false, $label);
}

function removeCacheFixture(string $path): void
{
    if (is_dir($path) && !is_link($path)) {
        foreach (new DirectoryIterator($path) as $item) {
            if (!$item->isDot()) {
                removeCacheFixture($item->getPathname());
            }
        }
        rmdir($path);
    } elseif (file_exists($path) || is_link($path)) {
        unlink($path);
    }
}

$fixtureRoot = sys_get_temp_dir() . '/unc-cache-checks-' . bin2hex(random_bytes(8));
mkdir($fixtureRoot, 0700);

try {
    // All records are synthetic. The extra columns must never enter the cache.
    $first = [' 001-TEST ', 'First synthetic record', '0900000000', 'Test clinic', 'Test address', 'Everest', '15 năm', '17/08/2024', '13-23', 'private note', 'unused'];
    $rows = [
        [''],
        $first,
        ['1-TEST', 'Different code'],
        ['ABC', 'Uppercase code'],
        ['abc', 'Lowercase code'],
        ['001-TEST', 'Later duplicate'],
        ['0', 'Zero code'],
    ];
    $json = json_encode(['content' => $rows], JSON_THROW_ON_ERROR);
    $loads = 0;
    $now = 1000;
    $loader = static function () use (&$json, &$loads): string {
        $loads++;
        return $json;
    };
    $clock = static function () use (&$now): int { return $now; };
    $directory = $fixtureRoot . '/shared';
    $cache = new SourceIndexCache($directory, 60, $loader, $clock);

    cacheVerify($cache->find('001-TEST') === array_slice($first, 0, 9), 'trim source code for the index and retain the first duplicate');
    cacheVerify($loads === 1, 'fetch the source on the first lookup');
    cacheVerify($cache->find('1-TEST')[1] === 'Different code', 'preserve leading zeros in distinct codes');
    cacheVerify($cache->find('ABC')[1] === 'Uppercase code' && $cache->find('abc')[1] === 'Lowercase code', 'preserve case-sensitive matching');
    cacheVerify($cache->find('0')[1] === 'Zero code', 'retain a string zero code');
    cacheVerify($cache->find('TEST') === null, 'reject partial matches');
    cacheVerify($cache->find('MISSING') === null, 'return a cached miss');
    cacheVerify($loads === 1, 'reuse one fetched sheet across different codes and misses');

    $cacheFile = $directory . '/index-v1.json';
    cacheVerify(is_file($cacheFile), 'persist the server-side source index');
    $saved = file_get_contents($cacheFile);
    $envelope = json_decode($saved, true, 64, JSON_THROW_ON_ERROR);
    cacheVerify($envelope['version'] === 1 && $envelope['source'] === hash('sha256', Unc\Warranty\SOURCE_URL), 'identify the cache schema and upstream source');
    cacheVerify($envelope['fetchedAt'] === 1000, 'record the supplied clock time');
    cacheVerify(isset($envelope['index']['code:001-TEST']), 'prefix index keys to preserve string identifiers');
    cacheVerify(count($envelope['index']['code:001-TEST']) === 9 && !str_contains($saved, 'private note'), 'store only source columns A through I');

    $newInstance = new SourceIndexCache($directory, 60, $loader, $clock);
    cacheVerify($newInstance->find('001-TEST') === array_slice($first, 0, 9) && $loads === 1, 'reuse the file cache across separate request objects');
    $rows[] = ['NEW-CODE', 'New synthetic record'];
    $json = json_encode(['content' => $rows], JSON_THROW_ON_ERROR);
    $now = 1059;
    cacheVerify($newInstance->find('NEW-CODE') === null && $loads === 1, 'do not refetch a cached miss before expiry');
    $now = 1060;
    cacheVerify($newInstance->find('NEW-CODE')[1] === 'New synthetic record' && $loads === 2, 'refresh at the exact TTL boundary');

    $beforeFailure = file_get_contents($cacheFile);
    $json = '<html>synthetic upstream error</html>';
    $now = 1120;
    cacheExpectSourceError(static fn() => $newInstance->find('001-TEST'), 'never serve an expired snapshot when upstream data is malformed');
    cacheVerify(file_get_contents($cacheFile) === $beforeFailure, 'leave the last snapshot untouched when refresh fails');
    $json = json_encode(['content' => $rows], JSON_THROW_ON_ERROR);
    cacheVerify($newInstance->find('001-TEST') === array_slice($first, 0, 9), 'recover on a later successful refresh');

    file_put_contents($cacheFile, 'not valid cache JSON');
    $loadsBefore = $loads;
    cacheVerify($newInstance->find('ABC')[1] === 'Uppercase code' && $loads === $loadsBefore + 1, 'recover from a corrupt cache file');
    $envelope = json_decode(file_get_contents($cacheFile), true, 64, JSON_THROW_ON_ERROR);
    $envelope['fetchedAt'] = $now + 60;
    file_put_contents($cacheFile, json_encode($envelope, JSON_THROW_ON_ERROR));
    $loadsBefore = $loads;
    cacheVerify($newInstance->find('ABC')[1] === 'Uppercase code' && $loads === $loadsBefore + 1, 'reject a cache timestamp in the future');

    $brokenDirectory = $fixtureRoot . '/broken-source';
    $brokenCache = new SourceIndexCache($brokenDirectory, 60, static fn(): string => '{broken', $clock);
    cacheExpectSourceError(static fn() => $brokenCache->find('ABC'), 'reject malformed source on a cold cache');
    cacheVerify(!is_file($brokenDirectory . '/index-v1.json'), 'do not persist a poisoned cache after a cold failure');

    $unusable = $fixtureRoot . '/regular-file';
    file_put_contents($unusable, 'not a directory');
    $fallbackCache = new SourceIndexCache($unusable, 60, $loader, $clock);
    $loadsBefore = $loads;
    cacheVerify($fallbackCache->find('ABC')[1] === 'Uppercase code', 'fall back to a direct lookup when the cache directory is unusable');
    cacheVerify($fallbackCache->find('abc')[1] === 'Lowercase code' && $loads === $loadsBefore + 2, 'keep uncached fallback requests independent');

    $disabledDirectory = $fixtureRoot . '/disabled';
    $disabledCache = new SourceIndexCache($disabledDirectory, 0, $loader, $clock);
    $loadsBefore = $loads;
    $disabledCache->find('ABC');
    $disabledCache->find('ABC');
    cacheVerify($loads === $loadsBefore + 2 && !is_file($disabledDirectory . '/index-v1.json'), 'TTL zero bypasses cache persistence');

    $loadsBefore = $loads;
    cacheVerify($disabledCache->refresh() === false && $loads === $loadsBefore, 'background refresh does not fetch when TTL is zero');
    cacheVerify($fallbackCache->refresh() === false && $loads === $loadsBefore, 'background refresh does not fetch when the cache directory is unusable');

    $refreshDirectory = $fixtureRoot . '/background-refresh';
    $refreshNow = 2000;
    $refreshLoads = 0;
    $refreshJson = '{"content":[["REFRESH-TEST","Original synthetic record"]]}';
    $refreshLoader = static function () use (&$refreshJson, &$refreshLoads): string {
        $refreshLoads++;
        return $refreshJson;
    };
    $refreshClock = static function () use (&$refreshNow): int { return $refreshNow; };
    $refreshCache = new SourceIndexCache($refreshDirectory, 60, $refreshLoader, $refreshClock);
    cacheVerify($refreshCache->find('REFRESH-TEST')[1] === 'Original synthetic record' && $refreshLoads === 1, 'prepare a fresh snapshot before a background refresh');
    cacheVerify($refreshCache->find('ADDED-LATER') === null && $refreshLoads === 1, 'cache a miss before a background refresh');
    $refreshJson = '{"content":[["REFRESH-TEST","Updated synthetic record"],["ADDED-LATER","New synthetic record"]]}';
    $refreshNow++;
    cacheVerify($refreshCache->refresh() === true && $refreshLoads === 2, 'force a background refresh even while the snapshot is fresh');
    cacheVerify($refreshCache->find('REFRESH-TEST')[1] === 'Updated synthetic record', 'make an updated record available immediately after refresh');
    cacheVerify($refreshCache->find('ADDED-LATER')[1] === 'New synthetic record' && $refreshLoads === 2, 'turn a cached miss into a hit without another upstream fetch');

    $refreshFile = $refreshDirectory . '/index-v1.json';
    $beforeRefreshFailure = file_get_contents($refreshFile);
    $refreshJson = '<html>synthetic refresh failure</html>';
    cacheExpectSourceError(static fn() => $refreshCache->refresh(), 'propagate invalid upstream data from background refresh');
    cacheVerify(file_get_contents($refreshFile) === $beforeRefreshFailure, 'preserve the persisted snapshot when background refresh fails');
    cacheVerify($refreshCache->find('REFRESH-TEST')[1] === 'Updated synthetic record' && $refreshLoads === 3, 'keep a still-fresh snapshot available after background refresh failure');

    $heldRefreshLock = fopen($refreshDirectory . '/refresh.lock', 'c');
    if ($heldRefreshLock === false || !flock($heldRefreshLock, LOCK_EX)) {
        throw new RuntimeException('Could not prepare a held background refresh lock');
    }
    try {
        $loadsBefore = $refreshLoads;
        $started = hrtime(true);
        cacheVerify($refreshCache->refresh() === false && $refreshLoads === $loadsBefore, 'skip a background refresh without fetching when another process holds the lock');
        cacheVerify((hrtime(true) - $started) / 1e6 < 1000, 'do not block while acquiring a background refresh lock');
        $started = hrtime(true);
        cacheVerify($refreshCache->find('REFRESH-TEST')[1] === 'Updated synthetic record' && $refreshLoads === $loadsBefore, 'serve a fresh snapshot while the refresh lock is held');
        cacheVerify((hrtime(true) - $started) / 1e6 < 1000, 'keep a cached lookup fast while a background refresh is in progress');
    } finally {
        flock($heldRefreshLock, LOCK_UN);
        fclose($heldRefreshLock);
    }

    $emptyLoads = 0;
    $emptyCache = new SourceIndexCache($fixtureRoot . '/empty', 60, static function () use (&$emptyLoads): string {
        $emptyLoads++;
        return '{"content":[]}';
    }, $clock);
    cacheVerify($emptyCache->find('ABC') === null && $emptyCache->find('OTHER') === null && $emptyLoads === 1, 'cache an intentionally empty source sheet');

    if (function_exists('pcntl_fork') && function_exists('pcntl_waitpid')) {
        $parallelDirectory = $fixtureRoot . '/parallel';
        $counterFile = $fixtureRoot . '/fetch-count';
        file_put_contents($counterFile, '0');
        $gate = $fixtureRoot . '/parallel-go';
        $children = [];
        for ($i = 0; $i < 2; $i++) {
            $pid = pcntl_fork();
            if ($pid === -1) {
                throw new RuntimeException('Could not start the cache concurrency check');
            }
            if ($pid === 0) {
                while (!is_file($gate)) {
                    usleep(1000);
                }
                try {
                    $parallelLoader = static function () use ($counterFile, $json): string {
                        $counter = fopen($counterFile, 'r+');
                        flock($counter, LOCK_EX);
                        $count = (int) stream_get_contents($counter);
                        rewind($counter);
                        ftruncate($counter, 0);
                        fwrite($counter, (string) ($count + 1));
                        fflush($counter);
                        flock($counter, LOCK_UN);
                        fclose($counter);
                        usleep(150000);
                        return $json;
                    };
                    $parallelCache = new SourceIndexCache($parallelDirectory, 60, $parallelLoader, $clock);
                    exit($parallelCache->find('ABC')[1] === 'Uppercase code' ? 0 : 1);
                } catch (Throwable $exception) {
                    exit(1);
                }
            }
            $children[] = $pid;
        }
        touch($gate);
        foreach ($children as $pid) {
            pcntl_waitpid($pid, $status);
            cacheVerify(pcntl_wifexited($status) && pcntl_wexitstatus($status) === 0, 'concurrent lookup returns the matching record');
        }
        cacheVerify(trim(file_get_contents($counterFile)) === '1', 'coalesce concurrent cold lookups into one upstream fetch');
    }

    echo "Cache checks passed: {$checks}\n";
} finally {
    removeCacheFixture($fixtureRoot);
}
