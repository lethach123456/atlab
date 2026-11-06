<?php
declare(strict_types=1);

require_once __DIR__ . '/backend/warranty.php';

ini_set('display_errors', '0');
Unc\Warranty\sendResponse(Unc\Warranty\handleRequest($_SERVER['REQUEST_METHOD'] ?? '', $_POST));
