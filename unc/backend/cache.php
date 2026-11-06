<?php
declare(strict_types=1);

namespace Unc\Warranty;

use Closure;
use JsonException;

/** A private snapshot shared across requests; only columns needed for lookup are kept. */
final class SourceIndexCache
{
    private Closure $loader;
    private Closure $clock;
    private const MAX_CACHE_BYTES = MAX_SOURCE_BYTES * 2 + 4096;

    public function __construct(
        private string $directory,
        private int $ttl = 60,
        ?callable $loader = null,
        ?callable $clock = null,
    ) {
        $this->loader = Closure::fromCallable($loader ?? __NAMESPACE__ . '\\fetchSource');
        $this->clock = Closure::fromCallable($clock ?? 'time');
    }

    public function find(string $code): ?array
    {
        $index = $this->getIndex();
        return $index['code:' . $code] ?? null;
    }

    /** Refresh proactively, without waiting behind another source download. */
    public function refresh(): bool
    {
        if ($this->ttl <= 0 || !$this->prepareDirectory()) {
            return false;
        }
        $lockPath = $this->directory . '/refresh.lock';
        if (is_link($lockPath)) {
            return false;
        }
        $lock = @fopen($lockPath, 'c');
        if ($lock === false) {
            return false;
        }
        if (!@chmod($lockPath, 0600) || !flock($lock, LOCK_EX | LOCK_NB)) {
            fclose($lock);
            return false;
        }
        try {
            return $this->writeIndex($this->fetchIndex());
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    private function getIndex(): array
    {
        if ($this->ttl <= 0 || !$this->prepareDirectory()) {
            return $this->fetchIndex();
        }
        $cached = $this->readFresh();
        if ($cached !== null) {
            return $cached;
        }

        $lockPath = $this->directory . '/refresh.lock';
        if (is_link($lockPath)) {
            return $this->fetchIndex();
        }
        $lock = @fopen($lockPath, 'c');
        if ($lock === false) {
            return $this->fetchIndex();
        }
        if (!@chmod($lockPath, 0600) || !flock($lock, LOCK_EX)) {
            fclose($lock);
            return $this->fetchIndex();
        }
        try {
            // Another request may already have refreshed the snapshot while this one waited.
            $cached = $this->readFresh();
            if ($cached !== null) {
                return $cached;
            }
            $index = $this->fetchIndex();
            $this->writeIndex($index);
            return $index;
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    private function prepareDirectory(): bool
    {
        return prepareCacheDirectory($this->directory);
    }

    private function fetchIndex(): array
    {
        $json = ($this->loader)();
        if (!is_string($json)) {
            throw new SourceException(SOURCE_ERROR_MESSAGE);
        }
        $index = [];
        foreach (decodeRows($json) as $row) {
            $code = cellText($row, 0);
            if ($code !== '' && !isset($index['code:' . $code])) {
                $index['code:' . $code] = array_slice($row, 0, 9);
            }
        }
        return $index;
    }

    private function readFresh(): ?array
    {
        $path = $this->directory . '/index-v1.json';
        clearstatcache(true, $path);
        if (is_link($path) || !is_file($path) || (filesize($path) ?: 0) > self::MAX_CACHE_BYTES) {
            return null;
        }
        $json = @file_get_contents($path);
        if ($json === false) {
            return null;
        }
        try {
            $snapshot = json_decode($json, true, 64, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return null;
        }
        $now = ($this->clock)();
        if (!is_array($snapshot) || ($snapshot['version'] ?? null) !== 1
            || ($snapshot['source'] ?? null) !== hash('sha256', SOURCE_URL)
            || !is_int($snapshot['fetchedAt'] ?? null)
            || $snapshot['fetchedAt'] > $now || $now - $snapshot['fetchedAt'] >= $this->ttl
            || !is_array($snapshot['index'] ?? null)) {
            return null;
        }
        foreach ($snapshot['index'] as $key => $row) {
            if (!is_string($key) || !str_starts_with($key, 'code:') || !is_array($row)
                || !array_is_list($row) || count($row) > 9) {
                return null;
            }
            try {
                if (cellText($row, 0) === '' || 'code:' . cellText($row, 0) !== $key) {
                    return null;
                }
            } catch (SourceException) {
                return null;
            }
        }
        return $snapshot['index'];
    }

    private function writeIndex(array $index): bool
    {
        $json = json_encode([
            'version' => 1,
            'source' => hash('sha256', SOURCE_URL),
            'fetchedAt' => ($this->clock)(),
            'index' => $index,
        ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        if (strlen($json) > self::MAX_CACHE_BYTES) {
            return false;
        }
        $temporary = @tempnam($this->directory, '.snapshot-');
        if ($temporary === false) {
            return false;
        }
        try {
            if (realpath(dirname($temporary)) !== realpath($this->directory)
                || !@chmod($temporary, 0600)
                || @file_put_contents($temporary, $json) !== strlen($json)) {
                return false;
            }
            return @rename($temporary, $this->directory . '/index-v1.json');
        } finally {
            if (is_file($temporary)) {
                @unlink($temporary);
            }
        }
    }
}

function prepareCacheDirectory(string $directory): bool
{
    if (is_link($directory)) {
        return false;
    }
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) {
        return false;
    }
    return @chmod($directory, 0700) && is_writable($directory);
}

function cacheTtl(): int
{
    $setting = getenv('WARRANTY_CACHE_TTL');
    return $setting !== false && ctype_digit($setting) ? min((int) $setting, 3600) : 60;
}

function cacheDirectory(): string
{
    return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . '/unc-warranty-'
        . substr(hash('sha256', __DIR__ . SOURCE_URL), 0, 20);
}

function cachedRow(string $code): ?array
{
    return (new SourceIndexCache(cacheDirectory(), cacheTtl()))->find($code);
}
