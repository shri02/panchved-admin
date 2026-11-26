<?php
/**
 * Panchved Admin - Get Dashboard Analytics & Statistics API
 * GET: /api/get_dashboard_stats.php
 *
 * Parameters:
 * - year (int, default current year)
 * - filter (string: 'last_12_months', 'last_6_months', 'last_3_months', 'this_year', 'prev_year', 'year')
 */

header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__ . '/database.php';

$current_system_year = (int) date('Y');
$year = intval($_GET['year'] ?? $current_system_year);
if ($year < 2020 || $year > 2035) {
    $year = $current_system_year;
}

$filter = trim($_GET['filter'] ?? 'last_12_months');

$total_patients = 0;
$total_doctors = 0;
$total_packages = 0;
$total_workshops = 0;

if ($connection1) {
    // 1. Total Patients
    $res = @mysqli_query($connection1, "SELECT COUNT(*) as total FROM patients");
    if ($res && $row = mysqli_fetch_assoc($res)) {
        $total_patients = (int) $row['total'];
    }

    // 2. Total Doctors
    $res = @mysqli_query($connection1, "SELECT COUNT(*) as total FROM doctors");
    if ($res && $row = mysqli_fetch_assoc($res)) {
        $total_doctors = (int) $row['total'];
    }

    // 3. Total Packages
    $res = @mysqli_query($connection1, "SELECT COUNT(*) as total FROM packages");
    if ($res && $row = mysqli_fetch_assoc($res)) {
        $total_packages = (int) $row['total'];
    }

    // 4. Total Workshops
    $res = @mysqli_query($connection1, "SELECT COUNT(*) as total FROM workshops");
    if ($res && $row = mysqli_fetch_assoc($res)) {
        $total_workshops = (int) $row['total'];
    }
}

// 5. Dynamic Monthly patient onboarding distribution from Database
$monthLabels = [
    1 => 'Jan', 2 => 'Feb', 3 => 'March', 4 => 'April', 5 => 'May', 6 => 'June',
    7 => 'July', 8 => 'Aug', 9 => 'Sep', 10 => 'Oct', 11 => 'Nov', 12 => 'Dec'
];

$now = new DateTime();
$chart_data = [];
$monthMap = [];

if ($filter === 'last_6_months') {
    $numMonths = 6;
    $start = (clone $now)->modify('-5 months')->modify('first day of this month')->setTime(0, 0, 0);
    $end = (clone $now)->modify('last day of this month')->setTime(23, 59, 59);
} elseif ($filter === 'last_3_months') {
    $numMonths = 3;
    $start = (clone $now)->modify('-2 months')->modify('first day of this month')->setTime(0, 0, 0);
    $end = (clone $now)->modify('last day of this month')->setTime(23, 59, 59);
} elseif ($filter === 'this_year') {
    $numMonths = 12;
    $start = new DateTime("$current_system_year-01-01 00:00:00");
    $end = new DateTime("$current_system_year-12-31 23:59:59");
} elseif ($filter === 'prev_year') {
    $prev_y = $current_system_year - 1;
    $numMonths = 12;
    $start = new DateTime("$prev_y-01-01 00:00:00");
    $end = new DateTime("$prev_y-12-31 23:59:59");
} elseif ($filter === 'year') {
    $numMonths = 12;
    $start = new DateTime("$year-01-01 00:00:00");
    $end = new DateTime("$year-12-31 23:59:59");
} else {
    // Default: 'last_12_months'
    $numMonths = 12;
    $start = (clone $now)->modify('-11 months')->modify('first day of this month')->setTime(0, 0, 0);
    $end = (clone $now)->modify('last day of this month')->setTime(23, 59, 59);
}

$curr = clone $start;
for ($i = 0; $i < $numMonths; $i++) {
    $y = (int) $curr->format('Y');
    $m = (int) $curr->format('n');
    $key = sprintf("%04d-%02d", $y, $m);
    $monthMap[$key] = [
        'month' => $monthLabels[$m],
        'month_num' => $m,
        'year' => $y,
        'label' => $monthLabels[$m] . ' ' . $y,
        'value' => 0
    ];
    $curr->modify('+1 month');
}

if ($connection1) {
    $startStr = $start->format('Y-m-d H:i:s');
    $endStr = $end->format('Y-m-d H:i:s');

    $sql = "SELECT YEAR(created_at) as y, MONTH(created_at) as m, COUNT(*) as cnt 
            FROM patients 
            WHERE created_at >= '$startStr' AND created_at <= '$endStr'
            GROUP BY YEAR(created_at), MONTH(created_at)";

    $res = @mysqli_query($connection1, $sql);
    if ($res) {
        while ($row = mysqli_fetch_assoc($res)) {
            $k = sprintf("%04d-%02d", (int)$row['y'], (int)$row['m']);
            if (isset($monthMap[$k])) {
                $monthMap[$k]['value'] = (int) $row['cnt'];
            }
        }
    }
}

$chart_data = array_values($monthMap);
$max_val = 0;
$total_onboarded_in_period = 0;
foreach ($chart_data as $pt) {
    if ($pt['value'] > $max_val) {
        $max_val = $pt['value'];
    }
    $total_onboarded_in_period += $pt['value'];
}

echo json_encode([
    'status' => '1',
    'message' => 'Dashboard statistics fetched successfully.',
    'data' => [
        'total_patients' => $total_patients,
        'total_doctors' => $total_doctors,
        'total_packages' => $total_packages,
        'total_workshops' => $total_workshops,
        'year' => $year,
        'filter' => $filter,
        'max_value' => $max_val,
        'total_in_period' => $total_onboarded_in_period,
        'chart_data' => $chart_data,
        'system_time' => date('Y-m-d H:i:s')
    ]
]);

