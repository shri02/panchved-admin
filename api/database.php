<?php

/*
|--------------------------------------------------------------------------
| DATABASE CONFIGURATION
|--------------------------------------------------------------------------
|
| Store your database credentials in variables.
| This makes the code easier to read and update later.
|
*/

// Database server IP address or hostname
$dbHost = "p:162.214.80.27";

// Database name
$dbName = "jewrzsmy_panchved";

// Database username
$dbUser = "jewrzsmy_panchveduser";

// Database password
$dbPass = '$hr1dhar@321';


/*
|--------------------------------------------------------------------------
| CREATE DATABASE CONNECTION
|--------------------------------------------------------------------------
|
| mysqli_connect() is used to connect PHP to MySQL.
|
| Parameters:
| 1. Host Name / IP Address
| 2. Username
| 3. Password
| 4. Database Name
|
*/

$connection1 = mysqli_connect(
    $dbHost,
    $dbUser,
    $dbPass,
    $dbName
);


/*
|--------------------------------------------------------------------------
| CHECK IF CONNECTION IS SUCCESSFUL
|--------------------------------------------------------------------------
|
| If connection fails, display the error and stop execution.
|
*/

if ($connection1 && !mysqli_connect_errno()) {
    mysqli_set_charset($connection1, "utf8mb4");
} else {
    $connection1 = null;
}


/*
|--------------------------------------------------------------------------
| CONNECTION SUCCESS MESSAGE (OPTIONAL)
|--------------------------------------------------------------------------
|
| Uncomment this line only for testing.
| Remove or comment it in production.
|
*/

// echo "Database Connected Successfully";


/*
|--------------------------------------------------------------------------
| HOW TO USE THIS FILE
|--------------------------------------------------------------------------
|
| In any API file, simply write:
|
| include 'database.php';
|
| Then use:
|
| $connection1
|
| for all database queries.
|
*/


/*
|--------------------------------------------------------------------------
| EXAMPLE QUERY
|--------------------------------------------------------------------------
|
| $result = mysqli_query(
|     $connection1,
|     "SELECT * FROM employees"
| );
|
*/

?>