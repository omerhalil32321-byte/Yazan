<?php
// إظهار الأخطاء لتتبع أي مشكلة تقنية إن وجدت
error_reporting(E_ALL);
ini_set('display_errors', 1);

// 1. بيانات الاتصال بقاعدة البيانات
$host     = 'sql309.infinityfree.com';
$port     = '3306';
$dbname   = 'if0_42300303_555';
$username = 'if0_42300303';
$password = 'cuCT2NKDjFIT9r';

// 2. الاتصال بقاعدة البيانات PDO
try {
    $dsn = "mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4";
    $pdo = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    // 3. إنشاء الجداول وتأكيد الأعمدة المطلوبة
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS products (
            id INT AUTO_INCREMENT PRIMARY KEY,
            category_id INT DEFAULT NULL,
            name VARCHAR(255) NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            cost_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            stock_qty INT NOT NULL DEFAULT 0,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS invoices (
            id INT AUTO_INCREMENT PRIMARY KEY,
            invoice_name VARCHAR(255) NOT NULL,
            status ENUM('OPEN', 'CLOSED') DEFAULT 'OPEN',
            total_amount DECIMAL(10,2) DEFAULT 0.00,
            opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            closed_at DATETIME NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS invoice_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            invoice_id INT NOT NULL,
            product_id INT NOT NULL,
            qty INT NOT NULL DEFAULT 1,
            unit_price DECIMAL(10,2) NOT NULL,
            cost_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            subtotal DECIMAL(10,2) NOT NULL,
            FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS inventory_reports (
            id INT AUTO_INCREMENT PRIMARY KEY,
            start_date DATETIME NOT NULL,
            end_date DATETIME NOT NULL,
            total_sales DECIMAL(10,2) NOT NULL,
            total_profit DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            total_invoices INT NOT NULL,
            most_sold VARCHAR(255) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    $colCheck = $pdo->query("SHOW COLUMNS FROM products LIKE 'category_id'");
    if ($colCheck->rowCount() == 0) {
        $pdo->exec("ALTER TABLE products ADD COLUMN category_id INT DEFAULT NULL");
    }

    // إدراج قسم افتراضي ومنتجات إذا كانت الجداول فارغة
    $catCount = $pdo->query("SELECT COUNT(*) FROM categories")->fetchColumn();
    if ($catCount == 0) {
        $pdo->exec("INSERT INTO categories (name) VALUES ('مشروبات ساخنة'), ('مشروبات باردة'), ('أراجيل'), ('وجبات')");
        $defaultCatId = $pdo->lastInsertId();
        $pdo->exec("UPDATE products SET category_id = $defaultCatId WHERE category_id IS NULL");
    }

    $stmtCount = $pdo->query("SELECT COUNT(*) FROM products");
    if ($stmtCount->fetchColumn() == 0) {
        $catHot = $pdo->query("SELECT id FROM categories WHERE name = 'مشروبات ساخنة' LIMIT 1")->fetchColumn() ?: 1;
        $catCold = $pdo->query("SELECT id FROM categories WHERE name = 'مشروبات باردة' LIMIT 1")->fetchColumn() ?: 1;
        $catShisha = $pdo->query("SELECT id FROM categories WHERE name = 'أراجيل' LIMIT 1")->fetchColumn() ?: 1;

        $pdo->exec("
            INSERT INTO products (category_id, name, price, cost_price, stock_qty) VALUES 
            ($catHot, 'إسبرسو', 2.50, 1.25, 500),
            ($catHot, 'قهوة تركي', 2.00, 1.00, 500),
            ($catHot, 'نسكافيه بلاك', 3.00, 1.50, 400),
            ($catCold, 'عصير برتقال فريش', 6.00, 3.00, 150),
            ($catCold, 'مبارد / موهيتو', 6.50, 3.00, 200),
            ($catShisha, 'أرجيلة تفاحتين', 7.00, 2.00, 100),
            ($catShisha, 'أرجيلة ليمون ونعنع', 7.00, 2.00, 100)
        ");
    }

} catch (PDOException $e) {
    if (isset($_GET['action'])) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(["success" => false, "message" => "خطأ في قاعدة البيانات: " . $e->getMessage()]);
        exit;
    }
    die("<div style='color:red; font-family:sans-serif; text-align:center; padding:20px; font-size: 26px; font-weight: bold;'>
            <h2>فشل الاتصال بقاعدة البيانات!</h2>
            <p>" . $e->getMessage() . "</p>
         </div>");
}

// 4. معالجة طلبات API
if (isset($_GET['action'])) {
    header('Content-Type: application/json; charset=utf-8');
    $action = $_GET['action'];

    if ($action === 'get_categories') {
        $cats = $pdo->query("SELECT * FROM categories ORDER BY id ASC")->fetchAll();
        echo json_encode($cats);
        exit;
    }

    if ($action === 'add_category' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $name = trim($input['name'] ?? '');
        $password = $input['password'] ?? '';

        if ($password !== 'Assi010') {
            echo json_encode(["success" => false, "message" => "كلمة السر غير صحيحة!"]);
            exit;
        }

        if ($name !== '') {
            $stmt = $pdo->prepare("INSERT INTO categories (name) VALUES (:name)");
            $stmt->execute(['name' => $name]);
            $cats = $pdo->query("SELECT * FROM categories ORDER BY id ASC")->fetchAll();
            echo json_encode(["success" => true, "categories" => $cats]);
            exit;
        }
        echo json_encode(["success" => false, "message" => "اسم القائمة فارغ"]);
        exit;
    }

    if ($action === 'delete_category' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = (int)($input['id'] ?? 0);
        $password = $input['password'] ?? '';

        if ($password !== 'Assi010') {
            echo json_encode(["success" => false, "message" => "كلمة السر غير صحيحة!"]);
            exit;
        }

        if ($id) {
            $pdo->prepare("UPDATE products SET category_id = NULL WHERE category_id = :id")->execute(['id' => $id]);
            $pdo->prepare("DELETE FROM categories WHERE id = :id")->execute(['id' => $id]);
            $cats = $pdo->query("SELECT * FROM categories ORDER BY id ASC")->fetchAll();
            echo json_encode(["success" => true, "categories" => $cats]);
            exit;
        }
        echo json_encode(["success" => false, "message" => "تعذر تحديد القائمة"]);
        exit;
    }

    if ($action === 'add_product' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $category_id = !empty($input['category_id']) ? (int)$input['category_id'] : null;
        $name = trim($input['name'] ?? '');
        $price = floatval($input['price'] ?? 0);
        $cost_price = floatval($input['cost_price'] ?? 0);
        $stock_qty = (int)($input['stock_qty'] ?? 0);

        if ($name !== '' && $price > 0) {
            $stmt = $pdo->prepare("INSERT INTO products (category_id, name, price, cost_price, stock_qty) VALUES (:cat, :name, :price, :cost_price, :stock_qty)");
            $stmt->execute(['cat' => $category_id, 'name' => $name, 'price' => $price, 'cost_price' => $cost_price, 'stock_qty' => $stock_qty]);
            
            $products = $pdo->query("SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.price DESC, p.id DESC")->fetchAll();
            echo json_encode(["success" => true, "products" => $products]);
            exit;
        }
        echo json_encode(["success" => false, "message" => "بيانات غير صالحة"]);
        exit;
    }

    if ($action === 'update_product' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = (int)($input['id'] ?? 0);
        $category_id = !empty($input['category_id']) ? (int)$input['category_id'] : null;
        $name = trim($input['name'] ?? '');
        $price = floatval($input['price'] ?? 0);
        $cost_price = floatval($input['cost_price'] ?? 0);
        $stock_qty = (int)($input['stock_qty'] ?? 0);
        $password = $input['password'] ?? '';

        if ($password !== 'Assi010') {
            echo json_encode(["success" => false, "message" => "كلمة السر غير صحيحة، لا يمكن تعديل الصنف!"]);
            exit;
        }

        if ($id && $name !== '' && $price >= 0) {
            $stmt = $pdo->prepare("UPDATE products SET category_id = :cat, name = :name, price = :price, cost_price = :cost_price, stock_qty = :stock_qty WHERE id = :id");
            $stmt->execute(['cat' => $category_id, 'name' => $name, 'price' => $price, 'cost_price' => $cost_price, 'stock_qty' => $stock_qty, 'id' => $id]);

            $stmtUpdateItems = $pdo->prepare("UPDATE invoice_items SET unit_price = :price, cost_price = :cost_price, subtotal = qty * :price WHERE product_id = :id");
            $stmtUpdateItems->execute(['price' => $price, 'cost_price' => $cost_price, 'id' => $id]);

            $openInvs = $pdo->query("SELECT id FROM invoices WHERE status = 'OPEN'")->fetchAll();
            foreach ($openInvs as $inv) {
                $sumStmt = $pdo->prepare("SELECT SUM(subtotal) FROM invoice_items WHERE invoice_id = :inv_id");
                $sumStmt->execute(['inv_id' => $inv['id']]);
                $total = $sumStmt->fetchColumn() ?: 0;

                $updInv = $pdo->prepare("UPDATE invoices SET total_amount = :total WHERE id = :inv_id");
                $updInv->execute(['total' => $total, 'inv_id' => $inv['id']]);
            }

            $products = $pdo->query("SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.price DESC, p.id DESC")->fetchAll();
            echo json_encode(["success" => true, "products" => $products]);
            exit;
        }
        echo json_encode(["success" => false, "message" => "بيانات التعديل غير صالحة"]);
        exit;
    }

    if ($action === 'delete_product' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = (int)($input['id'] ?? 0);
        $password = $input['password'] ?? '';

        if ($password !== 'Assi010') {
            echo json_encode(["success" => false, "message" => "كلمة السر غير صحيحة، لا يمكن حذف الصنف!"]);
            exit;
        }

        if ($id) {
            $delItemsStmt = $pdo->prepare("DELETE FROM invoice_items WHERE product_id = :id");
            $delItemsStmt->execute(['id' => $id]);

            $openInvs = $pdo->query("SELECT id FROM invoices WHERE status = 'OPEN'")->fetchAll();
            foreach ($openInvs as $inv) {
                $sumStmt = $pdo->prepare("SELECT SUM(subtotal) FROM invoice_items WHERE invoice_id = :inv_id");
                $sumStmt->execute(['inv_id' => $inv['id']]);
                $total = $sumStmt->fetchColumn() ?: 0;

                $updInv = $pdo->prepare("UPDATE invoices SET total_amount = :total WHERE id = :inv_id");
                $updInv->execute(['total' => $total, 'inv_id' => $inv['id']]);
            }

            $stmt = $pdo->prepare("DELETE FROM products WHERE id = :id");
            $stmt->execute(['id' => $id]);

            $products = $pdo->query("SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.price DESC, p.id DESC")->fetchAll();
            echo json_encode(["success" => true, "products" => $products]);
            exit;
        }
        echo json_encode(["success" => false, "message" => "تعذر تحديد الصنف للحذف"]);
        exit;
    }

    if ($action === 'get_products') {
        $products = $pdo->query("SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.price DESC, p.id DESC")->fetchAll();
        echo json_encode($products);
        exit;
    }

    if ($action === 'open_invoice' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $raw_input = trim($input['invoice_name'] ?? '');

        if ($raw_input === '') {
            $stmtCount = $pdo->query("SELECT COUNT(*) FROM invoices");
            $custom_name = "طاولة " . ($stmtCount->fetchColumn() + 1);
        } else {
            if (is_numeric($raw_input) || mb_strpos($raw_input, 'طاولة') === false) {
                $custom_name = "طاولة " . $raw_input;
            } else {
                $custom_name = $raw_input;
            }
        }

        $stmt = $pdo->prepare("INSERT INTO invoices (invoice_name, status, opened_at) VALUES (:name, 'OPEN', NOW())");
        $stmt->execute(['name' => $custom_name]);
        $inv_id = $pdo->lastInsertId();

        $stmtInv = $pdo->prepare("SELECT * FROM invoices WHERE id = :id");
        $stmtInv->execute(['id' => $inv_id]);
        $invoice = $stmtInv->fetch();
        $invoice['items'] = [];

        echo json_encode(["success" => true, "invoice" => $invoice]);
        exit;
    }

    if ($action === 'update_invoice_name' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $inv_id = (int)($input['invoice_id'] ?? 0);
        $raw_name = trim($input['invoice_name'] ?? '');

        if ($inv_id && $raw_name !== '') {
            if (is_numeric($raw_name) || mb_strpos($raw_name, 'طاولة') === false) {
                $new_name = "طاولة " . $raw_name;
            } else {
                $new_name = $raw_name;
            }

            $stmt = $pdo->prepare("UPDATE invoices SET invoice_name = :name WHERE id = :id AND status = 'OPEN'");
            $stmt->execute(['name' => $new_name, 'id' => $inv_id]);
            echo json_encode(["success" => true]);
            exit;
        }
        echo json_encode(["success" => false, "message" => "بيانات التعديل غير صالحة"]);
        exit;
    }

    if ($action === 'get_open_invoices') {
        $invoices = $pdo->query("SELECT * FROM invoices WHERE status = 'OPEN' ORDER BY id ASC")->fetchAll();
        foreach ($invoices as &$inv) {
            $stmtItems = $pdo->prepare("
                SELECT ii.*, p.name 
                FROM invoice_items ii 
                JOIN products p ON ii.product_id = p.id 
                WHERE ii.invoice_id = :inv_id
            ");
            $stmtItems->execute(['inv_id' => $inv['id']]);
            $inv['items'] = $stmtItems->fetchAll();
        }
        echo json_encode($invoices);
        exit;
    }

    if ($action === 'get_closed_invoices') {
        $invoices = $pdo->query("SELECT * FROM invoices WHERE status = 'CLOSED' ORDER BY closed_at DESC")->fetchAll();
        foreach ($invoices as &$inv) {
            $stmtItems = $pdo->prepare("
                SELECT ii.*, p.name 
                FROM invoice_items ii 
                JOIN products p ON ii.product_id = p.id 
                WHERE ii.invoice_id = :inv_id
            ");
            $stmtItems->execute(['inv_id' => $inv['id']]);
            $inv['items'] = $stmtItems->fetchAll();
        }
        echo json_encode($invoices);
        exit;
    }

    if ($action === 'add_item' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $inv_id = (int)($input['invoice_id'] ?? 0);
        $prod_id = (int)($input['product_id'] ?? 0);

        $stmtProd = $pdo->prepare("SELECT * FROM products WHERE id = :id");
        $stmtProd->execute(['id' => $prod_id]);
        $product = $stmtProd->fetch();

        if ($inv_id && $product) {
            if ($product['stock_qty'] <= 0) {
                echo json_encode(["success" => false, "message" => "عذراً، هذا الصنف نفد تماماً من المستودع!"]);
                exit;
            }

            $stmtStock = $pdo->prepare("UPDATE products SET stock_qty = stock_qty - 1 WHERE id = :id");
            $stmtStock->execute(['id' => $prod_id]);

            $stmtItem = $pdo->prepare("SELECT * FROM invoice_items WHERE invoice_id = :inv_id AND product_id = :prod_id");
            $stmtItem->execute(['inv_id' => $inv_id, 'prod_id' => $prod_id]);
            $existing = $stmtItem->fetch();

            if ($existing) {
                $new_qty = $existing['qty'] + 1;
                $new_subtotal = $new_qty * $product['price'];
                $stmtUpdate = $pdo->prepare("UPDATE invoice_items SET qty = :qty, subtotal = :subtotal WHERE id = :id");
                $stmtUpdate->execute(['qty' => $new_qty, 'subtotal' => $new_subtotal, 'id' => $existing['id']]);
            } else {
                $stmtInsert = $pdo->prepare("INSERT INTO invoice_items (invoice_id, product_id, qty, unit_price, cost_price, subtotal) VALUES (:inv_id, :prod_id, 1, :price, :cost_price, :price)");
                $stmtInsert->execute(['inv_id' => $inv_id, 'prod_id' => $prod_id, 'price' => $product['price'], 'cost_price' => $product['cost_price']]);
            }

            $stmtSum = $pdo->prepare("SELECT SUM(subtotal) FROM invoice_items WHERE invoice_id = :inv_id");
            $stmtSum->execute(['inv_id' => $inv_id]);
            $total = $stmtSum->fetchColumn() ?: 0;

            $stmtInvUpdate = $pdo->prepare("UPDATE invoices SET total_amount = :total WHERE id = :inv_id");
            $stmtInvUpdate->execute(['total' => $total, 'inv_id' => $inv_id]);

            echo json_encode(["success" => true]);
            exit;
        }
        echo json_encode(["success" => false, "message" => "تعذر إضافة المنتج"]);
        exit;
    }

    if ($action === 'decrease_item' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $inv_id = (int)($input['invoice_id'] ?? 0);
        $prod_id = (int)($input['product_id'] ?? 0);

        $stmtItem = $pdo->prepare("SELECT * FROM invoice_items WHERE invoice_id = :inv_id AND product_id = :prod_id");
        $stmtItem->execute(['inv_id' => $inv_id, 'prod_id' => $prod_id]);
        $item = $stmtItem->fetch();

        if ($item) {
            $stmtStock = $pdo->prepare("UPDATE products SET stock_qty = stock_qty + 1 WHERE id = :id");
            $stmtStock->execute(['id' => $prod_id]);

            if ($item['qty'] > 1) {
                $new_qty = $item['qty'] - 1;
                $new_subtotal = $new_qty * $item['unit_price'];
                $stmtUpdate = $pdo->prepare("UPDATE invoice_items SET qty = :qty, subtotal = :subtotal WHERE id = :id");
                $stmtUpdate->execute(['qty' => $new_qty, 'subtotal' => $new_subtotal, 'id' => $item['id']]);
            } else {
                $stmtDelete = $pdo->prepare("DELETE FROM invoice_items WHERE id = :id");
                $stmtDelete->execute(['id' => $item['id']]);
            }

            $stmtSum = $pdo->prepare("SELECT SUM(subtotal) FROM invoice_items WHERE invoice_id = :inv_id");
            $stmtSum->execute(['inv_id' => $inv_id]);
            $total = $stmtSum->fetchColumn() ?: 0;

            $stmtInvUpdate = $pdo->prepare("UPDATE invoices SET total_amount = :total WHERE id = :inv_id");
            $stmtInvUpdate->execute(['total' => $total, 'inv_id' => $inv_id]);

            echo json_encode(["success" => true]);
            exit;
        }
        echo json_encode(["success" => false, "message" => "تعذر التعديل"]);
        exit;
    }

    if ($action === 'delete_closed_invoice' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $inv_id = (int)($input['invoice_id'] ?? 0);
        $password = $input['password'] ?? '';

        if ($password !== 'Assi010') {
            echo json_encode(["success" => false, "message" => "كلمة السر غير صحيحة"]);
            exit;
        }

        $stmtItems = $pdo->prepare("SELECT * FROM invoice_items WHERE invoice_id = :id");
        $stmtItems->execute(['id' => $inv_id]);
        $items = $stmtItems->fetchAll();
        foreach ($items as $it) {
            $pdo->prepare("UPDATE products SET stock_qty = stock_qty + :qty WHERE id = :prod_id")
                ->execute(['qty' => $it['qty'], 'prod_id' => $it['product_id']]);
        }

        $stmtDel = $pdo->prepare("DELETE FROM invoices WHERE id = :id");
        $stmtDel->execute(['id' => $inv_id]);
        echo json_encode(["success" => true]);
        exit;
    }

    if ($action === 'reopen_invoice' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $inv_id = (int)($input['invoice_id'] ?? 0);
        $password = $input['password'] ?? '';

        if ($password !== 'Assi010') {
            echo json_encode(["success" => false, "message" => "كلمة السر غير صحيحة"]);
            exit;
        }

        $stmtUpdate = $pdo->prepare("UPDATE invoices SET status = 'OPEN', closed_at = NULL WHERE id = :id");
        $stmtUpdate->execute(['id' => $inv_id]);
        echo json_encode(["success" => true]);
        exit;
    }

    if ($action === 'delete_inventory_report' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $report_id = (int)($input['report_id'] ?? 0);
        $password = $input['password'] ?? '';

        if ($password !== 'Assi010') {
            echo json_encode(["success" => false, "message" => "كلمة السر غير صحيحة"]);
            exit;
        }

        $stmtDel = $pdo->prepare("DELETE FROM inventory_reports WHERE id = :id");
        $stmtDel->execute(['id' => $report_id]);
        echo json_encode(["success" => true]);
        exit;
    }

    if ($action === 'close_invoice' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $inv_id = (int)($input['invoice_id'] ?? 0);

        $itemsCheck = $pdo->prepare("SELECT * FROM invoice_items WHERE invoice_id = :id");
        $itemsCheck->execute(['id' => $inv_id]);
        $invItems = $itemsCheck->fetchAll();
        foreach($invItems as $item) {
            if ($item['cost_price'] == 0) {
                $pStmt = $pdo->prepare("SELECT cost_price FROM products WHERE id = :pid");
                $pStmt->execute(['pid' => $item['product_id']]);
                $cp = $pStmt->fetchColumn() ?: 0;
                $pdo->prepare("UPDATE invoice_items SET cost_price = :cp WHERE id = :id")->execute(['cp' => $cp, 'id' => $item['id']]);
            }
        }

        $stmtUpdate = $pdo->prepare("UPDATE invoices SET status = 'CLOSED', closed_at = NOW() WHERE id = :id");
        $stmtUpdate->execute(['id' => $inv_id]);
        echo json_encode(["success" => true]);
        exit;
    }

    if ($action === 'get_inventory_report') {
        $start = $_GET['start'] ?? null;
        $end = $_GET['end'] ?? null;

        $query = "SELECT ii.product_id, p.name, SUM(ii.qty) as total_qty, SUM(ii.subtotal) as total_sales, 
                  SUM(ii.qty * ii.cost_price) as total_cost 
                  FROM invoice_items ii 
                  JOIN invoices i ON ii.invoice_id = i.id 
                  JOIN products p ON ii.product_id = p.id 
                  WHERE i.status = 'CLOSED'";
        
        $params = [];
        if ($start) {
            $query .= " AND i.closed_at >= :start";
            $params['start'] = $start . ' 00:00:00';
        }
        if ($end) {
            $query .= " AND i.closed_at <= :end";
            $params['end'] = $end . ' 23:59:59';
        }

        $query .= " GROUP BY ii.product_id, p.name ORDER BY total_sales DESC";

        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        $stats = $stmt->fetchAll();

        $total_profit = 0;
        foreach($stats as &$st) {
            $item_profit = $st['total_sales'] - $st['total_cost'];
            $st['total_profit'] = $item_profit;
            $total_profit += $item_profit;
        }

        $invQuery = "SELECT COUNT(*) as total_inv, SUM(total_amount) as total_sum FROM invoices WHERE status = 'CLOSED'";
        $invParams = [];
        if ($start && $end) {
            $invQuery .= " AND closed_at >= :start AND closed_at <= :end";
            $invParams['start'] = $start . ' 00:00:00';
            $invParams['end'] = $end . ' 23:59:59';
        }
        $stmtInv = $pdo->prepare($invQuery);
        $stmtInv->execute($invParams);
        $totals = $stmtInv->fetch();

        $sales_sum = floatval($totals['total_sum'] ?? 0);
        if ($total_profit == 0 && $sales_sum > 0) {
            $costQ = "SELECT SUM(ii.qty * IF(ii.cost_price>0, ii.cost_price, ii.unit_price*0.5)) as c_sum 
                      FROM invoice_items ii JOIN invoices i ON ii.invoice_id = i.id WHERE i.status='CLOSED'";
            if ($start && $end) {
                $costQ .= " AND i.closed_at >= '$start 00:00:00' AND i.closed_at <= '$end 23:59:59'";
            }
            $cSumVal = $pdo->query($costQ)->fetchColumn() ?: ($sales_sum * 0.5);
            $total_profit = $sales_sum - $cSumVal;
        }

        $most_sold = "لا يوجد";
        $max_qty = 0;
        foreach ($stats as $stat) {
            if ($stat['total_qty'] > $max_qty) {
                $max_qty = $stat['total_qty'];
                $most_sold = $stat['name'] . " (" . $stat['total_qty'] . " قطعة)";
            }
        }

        $savedReports = $pdo->query("SELECT * FROM inventory_reports ORDER BY id DESC LIMIT 10")->fetchAll();

        echo json_encode([
            "total_sales" => $sales_sum,
            "total_profit" => floatval($total_profit),
            "total_invoices" => intval($totals['total_inv'] ?? 0),
            "most_sold" => $most_sold,
            "product_stats" => $stats,
            "saved_reports" => $savedReports
        ]);
        exit;
    }

    if ($action === 'save_inventory_report' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $start = $input['start_date'] ?? date('Y-m-d');
        $end = $input['end_date'] ?? date('Y-m-d');
        $total_sales = floatval($input['total_sales'] ?? 0);
        $total_profit = floatval($input['total_profit'] ?? 0);
        $total_invoices = intval($input['total_invoices'] ?? 0);
        $most_sold = trim($input['most_sold'] ?? 'لا يوجد');

        $stmt = $pdo->prepare("
            INSERT INTO inventory_reports (start_date, end_date, total_sales, total_profit, total_invoices, most_sold, created_at)
            VALUES (:start, :end, :sales, :profit, :invoices, :most_sold, NOW())
        ");
        $stmt->execute([
            'start' => $start . ' 00:00:00',
            'end' => $end . ' 23:59:59',
            'sales' => $total_sales,
            'profit' => $total_profit,
            'invoices' => $total_invoices,
            'most_sold' => $most_sold
        ]);

        echo json_encode(["success" => true, "message" => "تم حفظ تقرير الجرد والأرباح بنجاح في قاعدة البيانات"]);
        exit;
    }
}
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>نظام الكاشير ومشروبات الكافيه لـ يوسف</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@900&display=swap" rel="stylesheet">
    
    <style>
        * {
            font-family: 'Cairo', sans-serif !important;
            font-weight: 900 !important;
            -webkit-font-smoothing: antialiased;
            box-sizing: border-box;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
            -webkit-touch-callout: none;
            color: #000000 !important;
        }

        body { 
            background: #fff7ed; 
            padding: 20px; 
            margin: 0; 
            font-size: 26px; 
        }
        
        h2 { font-size: 38px; margin: 0; font-weight: 900 !important; }
        h3 { font-size: 34px; margin-top: 0; margin-bottom: 15px; font-weight: 900 !important; }
        h4 { font-size: 30px; font-weight: 900 !important; }
        p, div, span, td, th, label { font-size: 26px; font-weight: 900 !important; }

        .header { display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 22px; border-radius: 16px; margin-bottom: 20px; box-shadow: 0 4px 10px rgba(234,88,12,0.1); border-top: 6px solid #f97316; }
        .tabs { display: flex; gap: 10px; }
        
        .tab-btn { background: #ffedd5; color: #000000 !important; border: none; padding: 16px 26px; border-radius: 12px; cursor: pointer; font-size: 26px; font-weight: 900 !important; transition: 0.2s; }
        .tab-btn.active { background: #f97316; color: #ffffff !important; }
        
        .main-container { display: flex; gap: 20px; }
        .section { background: white; padding: 26px; border-radius: 16px; flex: 1; box-shadow: 0 4px 12px rgba(234,88,12,0.08); border: 2px solid #fed7aa; }
        
        .open-invoices-bar { display: flex; gap: 15px; overflow-x: auto; padding-bottom: 10px; margin-bottom: 15px; border-bottom: 3px solid #ffedd5; }
        
        .inv-chip { 
            background: #ffffff; 
            color: #000000 !important; 
            padding: 22px 40px; 
            border-radius: 20px; 
            cursor: pointer; 
            white-space: nowrap; 
            font-size: 38px; 
            font-weight: 900 !important;
            box-shadow: 0 8px 20px rgba(249,115,22,0.2);
            transition: 0.2s;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            letter-spacing: 1px;
            border-width: 6px;
            border-style: solid;
        }
        .inv-chip.active { 
            background: #ffedd5; 
            box-shadow: 0 8px 22px rgba(249, 115, 22, 0.4);
            transform: scale(1.03);
        }

        /* أزرار أقسام الكاشير */
        .categories-bar {
            display: flex;
            gap: 12px;
            overflow-x: auto;
            padding-bottom: 15px;
            margin-bottom: 15px;
            border-bottom: 3px solid #ffedd5;
        }

        .cat-tab-btn {
            background: #ffedd5;
            color: #000000 !important;
            border: 3px solid #f97316;
            padding: 12px 24px;
            border-radius: 14px;
            cursor: pointer;
            font-size: 26px;
            font-weight: 900 !important;
            white-space: nowrap;
            transition: 0.2s;
        }

        .cat-tab-btn.active {
            background: #f97316;
            color: #ffffff !important;
        }
        
        button { background: #f97316; color: #ffffff !important; border: none; padding: 16px 26px; border-radius: 12px; cursor: pointer; font-size: 26px; font-weight: 900 !important; margin: 4px; transition: 0.2s; }
        button:hover { opacity: 0.9; }
        .btn-green { background: #10b981; }
        .btn-orange { background: #f97316; }
        .btn-sm { padding: 10px 18px; font-size: 22px; margin: 0 2px; }
        .btn-red { background: #ef4444; }
        
        #productsButtons {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            max-height: 580px;
            overflow-y: auto;
        }

        #productsButtons button {
            background: #fdba74;
            color: #000000 !important;
            padding: 22px 20px;
            font-size: 32px;
            font-weight: 900 !important;
            border-radius: 16px;
            box-shadow: 0 6px 14px rgba(234, 88, 12, 0.3);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-width: 210px;
            line-height: 1.4;
            border: 4px solid #ea580c;
            letter-spacing: 0.5px;
        }

        #productsButtons button div {
            font-size: 34px !important;
            font-weight: 900 !important;
            color: #000000 !important;
            margin-bottom: 6px;
        }

        #productsButtons button span.price-tag {
            font-size: 26px !important;
            color: #000000 !important;
            font-weight: 900 !important;
            margin-top: 4px;
        }

        #productsButtons button span.stock-tag {
            font-size: 22px !important;
            color: #000000 !important;
            font-weight: 900 !important;
            margin-top: 4px;
        }

        input, select { padding: 16px; border: 3px solid #fed7aa; border-radius: 12px; margin: 4px; font-size: 26px; font-weight: 900 !important; outline: none; -webkit-user-select: text; user-select: text; color: #000000 !important; background: #fff; }
        input:focus, select:focus { border-color: #f97316; }
        
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 2px solid #fed7aa; padding: 18px; text-align: right; font-size: 26px; font-weight: 900 !important; color: #000000 !important; }
        th { background: #ffedd5; font-size: 28px; }

        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); justify-content: center; align-items: center; z-index: 1000; }
        .modal-content { background: white; padding: 36px; border-radius: 16px; width: 600px; max-width: 90%; text-align: center; font-size: 26px; border: 4px solid #fed7aa; }
        
        .stats-grid { display: flex; gap: 15px; margin-bottom: 20px; }
        .stat-card { background: #fff7ed; padding: 26px; border-radius: 16px; flex: 1; text-align: center; border-top: 6px solid #f97316; border: 2px solid #fed7aa; }
        .stat-value { font-size: 38px; color: #000000 !important; font-weight: 900 !important; margin-top: 8px; }
    </style>
</head>
<body>

    <div class="header">
        <h2>نظام الكاشير ومشروبات الكافيه لـ يوسف</h2>
        <div class="tabs">
            <button class="tab-btn active" id="btnPosTab" onclick="switchTab('pos')">الكاشير المباشر</button>
            <button class="tab-btn" id="btnProductsTab" onclick="switchTab('products')">إدارة الأقسام والأصناف</button>
            <button class="tab-btn" id="btnHistoryTab" onclick="switchTab('history')">سجل الفواتير المغلقة</button>
            <button class="tab-btn" id="btnReportTab" onclick="switchTab('report')">تقارير الجرد والأرباح</button>
        </div>
    </div>

    <!-- 1. شاشة الكاشير -->
    <div id="posView">
        <div class="section" style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3>الفواتير المفتوحة حالياً:</h3>
                <div>
                    <input type="text" id="newInvoiceName" placeholder="رقم أو اسم الطاولة">
                    <button class="btn-green" onclick="openNewInvoice()">+ فتح فاتورة جديدة</button>
                </div>
            </div>
            <div class="open-invoices-bar" id="openInvoicesBar"></div>
        </div>

        <div class="main-container">
            <div class="section">
                <h3>أقسام وقائمة المشروبات والأصناف</h3>
                <!-- شريط تصفية الأقسام في الكاشير -->
                <div class="categories-bar" id="posCategoriesBar"></div>
                <div id="productsButtons"></div>
            </div>

            <div class="section">
                <h3>تفاصيل الفاتورة النشطة</h3>
                <div id="activeInvoiceDetails">اختر أو افتح فاتورة للبدء</div>
            </div>
        </div>
    </div>

    <!-- 2. شاشة إدارة الأقسام والأصناف -->
    <div id="productsView" style="display: none;">
        <!-- إدارة القوائم والأقسام -->
        <div class="section" style="margin-bottom: 20px;">
            <h3>إدارة قوائم وأقسام الأصناف (مثال: مشروبات، أراجيل، وجبات)</h3>
            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                <input type="text" id="catNameInput" placeholder="اسم القائمة الجديدة" style="flex: 1;">
                <input type="password" id="catPasswordInput" placeholder="كلمة السر" style="width: 200px;">
                <button class="btn-green" onclick="addNewCategory()">+ إضافة قائمة جديدة</button>
            </div>
            <table>
                <thead>
                    <tr><th>#</th><th>اسم القائمة / القسم</th><th>الإجراء</th></tr>
                </thead>
                <tbody id="categoriesTableBody"></tbody>
            </table>
        </div>

        <!-- إدارة الأصناف -->
        <div class="section">
            <h3>إضافة صنف جديد (تحديد القائمة، الأسعار، والمستودع)</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 15px;">
                <select id="prodCategory">
                    <option value="">اختر القائمة / القسم</option>
                </select>
                <input type="text" id="prodName" placeholder="اسم الصنف">
                <input type="number" id="prodCost" placeholder="سعر الشراء" step="0.25">
                <input type="number" id="prodPrice" placeholder="سعر البيع" step="0.25">
                <input type="number" id="prodStock" placeholder="الكمية بالمستودع">
                <button class="btn-green" onclick="addNewProduct()">حفظ الصنف</button>
            </div>
            <hr style="margin: 20px 0;">
            <h3>قائمة المشروبات والأصناف الحالية</h3>
            <table>
                <thead>
                    <tr><th>#</th><th>القائمة</th><th>اسم الصنف</th><th>سعر الشراء</th><th>سعر البيع</th><th>المتبقي</th><th>الإجراءات</th></tr>
                </thead>
                <tbody id="productsTableBody"></tbody>
            </table>
        </div>
    </div>

    <!-- 3. شاشة سجل الفواتير المغلقة -->
    <div id="historyView" style="display: none;">
        <div class="section">
            <h3>سجل الفواتير المغلقة</h3>
            <table>
                <thead>
                    <tr>
                        <th>رقم الفاتورة</th>
                        <th>اسم الزبون / الطاولة</th>
                        <th>وقت الفتح</th>
                        <th>وقت الإغلاق</th>
                        <th>المجموع الإجمالي</th>
                        <th>التفاصيل والإجراءات</th>
                    </tr>
                </thead>
                <tbody id="closedInvoicesTable"></tbody>
            </table>
        </div>
    </div>

    <!-- 4. شاشة الجرد والتقارير والأرباح -->
    <div id="reportView" style="display: none;">
        <div class="section" style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3>تحديد فترة الجرد والأرباح من قاعدة البيانات</h3>
                <button class="btn-green" onclick="saveCurrentReport()">تثبيت وحفظ تقرير الجرد</button>
            </div>
            <div style="margin-top: 15px;">
                <button onclick="setFilter('today')">جرد اليوم</button>
                <button onclick="setFilter('week')">جرد الأسبوع</button>
                <button onclick="setFilter('month')">جرد الشهر</button>
                <button onclick="setFilter('year')">جرد السنة</button>
                <span style="margin: 0 10px;">أو تحديد تاريخ:</span>
                من: <input type="date" id="startDate">
                إلى: <input type="date" id="endDate">
                <button class="btn-green" onclick="loadInventoryReport()">تطبيق الفلتر</button>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div>إجمالي المبيعات</div>
                <div class="stat-value" id="statTotalSales">0</div>
            </div>
            <div class="stat-card" style="border-top-color: #10b981;">
                <div>إجمالي صافي الأرباح</div>
                <div class="stat-value" style="color: #10b981 !important;" id="statTotalProfit">0</div>
            </div>
            <div class="stat-card">
                <div>عدد الفواتير المغلقة</div>
                <div class="stat-value" id="statTotalInvoices">0</div>
            </div>
            <div class="stat-card">
                <div>الصنف الأكثر مبيعاً</div>
                <div class="stat-value" style="font-size: 28px;" id="statMostSold">-</div>
            </div>
        </div>

        <div class="section" style="margin-bottom: 20px;">
            <h3>تفاصيل مبيعات وأرباح كل مشروب بالجرد</h3>
            <table>
                <thead>
                    <tr>
                        <th>اسم الصنف</th>
                        <th>الكمية المباعة</th>
                        <th>الإيرادات الناتجة</th>
                        <th>صافي الربح للصنف</th>
                    </tr>
                </thead>
                <tbody id="inventoryTableBody"></tbody>
            </table>
        </div>

        <div class="section">
            <h3>أرشيف جلسات الجرد والأرباح المحفوظة في قاعدة البيانات</h3>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>تاريخ البداية</th>
                        <th>تاريخ النهاية</th>
                        <th>إجمالي المبيعات</th>
                        <th>صافي الأرباح</th>
                        <th>عدد الفواتير</th>
                        <th>الأكثر مبيعاً</th>
                        <th>تاريخ الحفظ</th>
                        <th>الإجراء</th>
                    </tr>
                </thead>
                <tbody id="savedReportsTableBody"></tbody>
            </table>
        </div>
    </div>

    <!-- النافذة المنبثقة لتعديل اسم الزبون للفاتورة النشطة -->
    <div class="modal" id="editInvoiceNameModal">
        <div class="modal-content">
            <h3>تعديل اسم أو رقم الطاولة</h3>
            <p>أدخل الرقم أو الاسم الجديد للطاولة:</p>
            <input type="text" id="updatedInvoiceNameInput" placeholder="رقم أو اسم الطاولة" style="width: 90%; text-align: center; font-size: 26px; margin-bottom: 15px;">
            <div style="display: flex; gap: 10px;">
                <button class="btn-green" style="flex: 1;" onclick="confirmUpdateInvoiceName()">حفظ الاسم الجديد</button>
                <button style="flex: 1; background: #64748b;" onclick="closeEditInvoiceNameModal()">إلغاء</button>
            </div>
        </div>
    </div>

    <!-- النافذة المنبثقة لإدارة الفاتورة المغلقة (كلمة السر) -->
    <div class="modal" id="authModal">
        <div class="modal-content">
            <h3 id="authModalTitle">إدارة الفاتورة المغلقة</h3>
            <p>أدخل كلمة المرور لتأكيد الإجراء:</p>
            <input type="password" id="authPassInput" placeholder="كلمة المرور" style="width: 80%; text-align: center; font-size: 26px; margin-bottom: 15px;">
            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 10px;">
                <button class="btn-red" onclick="handleAuthAction('delete')">مسح الفاتورة</button>
                <button class="btn-orange" onclick="handleAuthAction('reopen')">إعادتها للعمل (إكمال الطلبات)</button>
            </div>
            <button style="width: 100%; margin-top: 15px; background: #64748b;" onclick="closeAuthModal()">إلغاء</button>
        </div>
    </div>

    <!-- النافذة المنبثقة لحذف تقرير الجرد المحفوظ (كلمة السر) -->
    <div class="modal" id="reportAuthModal">
        <div class="modal-content">
            <h3>حذف أرشيف تقرير الجرد والأرباح</h3>
            <p>أدخل كلمة المرور لحذف تقرير الجرد رقم <span id="reportIdSpan"></span>:</p>
            <input type="password" id="reportAuthPassInput" placeholder="كلمة المرور" style="width: 80%; text-align: center; font-size: 26px; margin-bottom: 15px;">
            <button class="btn-red" style="width: 100%;" onclick="confirmDeleteReport()">تأكيد الحذف</button>
            <button style="width: 100%; margin-top: 10px; background: #64748b;" onclick="closeReportAuthModal()">إلغاء</button>
        </div>
    </div>

    <!-- النافذة المنبثقة لتعديل أو حذف الصنف والمستودع (تتطلب كلمة السر) -->
    <div class="modal" id="editProductModal">
        <div class="modal-content">
            <h3 id="productModalTitle">تعديل الصنف والقائمة والأسعار</h3>
            <input type="hidden" id="editProdId">
            <div style="margin-bottom: 15px; text-align: right;">
                <label>اختر القائمة / القسم:</label>
                <select id="editProdCategory" style="width: 95%;">
                    <option value="">بدون قائمة</option>
                </select>
            </div>
            <div style="margin-bottom: 15px; text-align: right;">
                <label>اسم الصنف:</label>
                <input type="text" id="editProdName" style="width: 95%;">
            </div>
            <div style="margin-bottom: 15px; text-align: right;">
                <label>سعر الشراء:</label>
                <input type="number" id="editProdCost" step="0.25" style="width: 95%;">
            </div>
            <div style="margin-bottom: 15px; text-align: right;">
                <label>سعر البيع:</label>
                <input type="number" id="editProdPrice" step="0.25" style="width: 95%;">
            </div>
            <div style="margin-bottom: 15px; text-align: right;">
                <label>الكمية المتبقية في المستودع:</label>
                <input type="number" id="editProdStock" style="width: 95%;">
            </div>
            <div style="margin-bottom: 20px; text-align: right;">
                <label style="color: #ef4444;">كلمة المرور المطلوبة للتنفيذ:</label>
                <input type="password" id="productActionPassword" placeholder="أدخل كلمة السر هنا" style="width: 95%; text-align: center;">
            </div>
            <div style="display: flex; gap: 10px;">
                <button class="btn-green" style="flex: 1;" onclick="saveProductUpdate()">حفظ التعديلات</button>
                <button class="btn-red" style="flex: 1;" onclick="confirmDeleteProductWithPassword()">حذف الصنف</button>
            </div>
            <button style="width: 100%; margin-top: 10px; background: #64748b;" onclick="closeEditProductModal()">إلغاء</button>
        </div>
    </div>

    <!-- النافذة المنبثقة لعرض محتويات الفاتورة -->
    <div class="modal" id="invoiceModal">
        <div class="modal-content" style="text-align: right;">
            <h3 id="modalTitle">تفاصيل الفاتورة</h3>
            <div id="modalBody"></div>
            <button style="width: 100%; margin-top: 20px;" onclick="closeModal()">إغلاق النافذة</button>
        </div>
    </div>

    <script>
        let currentOpenInvoices = [];
        let currentClosedInvoices = [];
        let currentProducts = [];
        let currentCategories = [];
        let activeCategoryId = 'all';
        let activeInvoiceId = null;
        let selectedClosedInvoiceId = null;
        let selectedReportIdToDelete = null;
        let lastReportData = {};

        const tableBorderColors = [
            '#f97316', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#06b6d4', '#eab308', '#ef4444', '#14b8a6'
        ];

        function switchTab(tab) {
            document.getElementById('posView').style.display = tab === 'pos' ? 'block' : 'none';
            document.getElementById('productsView').style.display = tab === 'products' ? 'block' : 'none';
            document.getElementById('historyView').style.display = tab === 'history' ? 'block' : 'none';
            document.getElementById('reportView').style.display = tab === 'report' ? 'block' : 'none';
            
            document.getElementById('btnPosTab').classList.toggle('active', tab === 'pos');
            document.getElementById('btnProductsTab').classList.toggle('active', tab === 'products');
            document.getElementById('btnHistoryTab').classList.toggle('active', tab === 'history');
            document.getElementById('btnReportTab').classList.toggle('active', tab === 'report');
            
            if (tab === 'history') loadClosedInvoices();
            if (tab === 'products') loadDataForManagement();
            if (tab === 'pos') loadOpenInvoices();
            if (tab === 'report') setFilter('today');
        }

        async function loadDataForManagement() {
            await loadCategories();
            await loadProducts();
        }

        async function loadCategories() {
            const res = await fetch('index.php?action=get_categories');
            currentCategories = await res.json();
            renderCategoriesDropdowns();
            renderCategoriesTable();
        }

        function renderCategoriesDropdowns() {
            const selectAdd = document.getElementById('prodCategory');
            const selectEdit = document.getElementById('editProdCategory');
            
            let optionsHTML = '<option value="">بدون قائمة / عام</option>';
            currentCategories.forEach(cat => {
                optionsHTML += `<option value="${cat.id}">${cat.name}</option>`;
            });

            selectAdd.innerHTML = optionsHTML;
            selectEdit.innerHTML = optionsHTML;
        }

        function renderCategoriesTable() {
            const tbody = document.getElementById('categoriesTableBody');
            tbody.innerHTML = '';
            if (currentCategories.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">لا توجد قوائم مضافة.</td></tr>';
                return;
            }
            currentCategories.forEach(cat => {
                tbody.innerHTML += `
                    <tr>
                        <td>#${cat.id}</td>
                        <td>${cat.name}</td>
                        <td>
                            <button class="btn-red btn-sm" onclick="deleteCategory(${cat.id})">حذف القائمة</button>
                        </td>
                    </tr>
                `;
            });
        }

        async function addNewCategory() {
            const name = document.getElementById('catNameInput').value.trim();
            const password = document.getElementById('catPasswordInput').value;
            if (!name) return alert("الرجاء إدخال اسم القائمة");

            const res = await fetch('index.php?action=add_category', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password })
            });
            const data = await res.json();
            if (data.success) {
                document.getElementById('catNameInput').value = '';
                document.getElementById('catPasswordInput').value = '';
                currentCategories = data.categories;
                renderCategoriesDropdowns();
                renderCategoriesTable();
                alert("تمت إضافة القائمة بنجاح");
            } else {
                alert(data.message);
            }
        }

        async function deleteCategory(id) {
            const password = prompt("أدخل كلمة المرور لحذف هذه القائمة:");
            if (!password) return;

            const res = await fetch('index.php?action=delete_category', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, password })
            });
            const data = await res.json();
            if (data.success) {
                currentCategories = data.categories;
                renderCategoriesDropdowns();
                renderCategoriesTable();
                loadProducts();
                alert("تم حذف القائمة بنجاح");
            } else {
                alert(data.message);
            }
        }

        async function loadProducts() {
            const res = await fetch('index.php?action=get_products');
            currentProducts = await res.json();
            renderPosCategoriesBar();
            renderProductsButtons();
            renderProductsTable();
        }

        function renderPosCategoriesBar() {
            const bar = document.getElementById('posCategoriesBar');
            bar.innerHTML = '';

            let allActive = activeCategoryId === 'all' ? 'active' : '';
            bar.innerHTML += `<button class="cat-tab-btn ${allActive}" onclick="filterCategory('all')">جميع الأصناف</button>`;

            currentCategories.forEach(cat => {
                let catActive = activeCategoryId == cat.id ? 'active' : '';
                bar.innerHTML += `<button class="cat-tab-btn ${catActive}" onclick="filterCategory(${cat.id})">${cat.name}</button>`;
            });
        }

        function filterCategory(catId) {
            activeCategoryId = catId;
            renderPosCategoriesBar();
            renderProductsButtons();
        }

        function renderProductsButtons() {
            const div = document.getElementById('productsButtons');
            div.innerHTML = '';

            let filtered = currentProducts;
            if (activeCategoryId !== 'all') {
                filtered = currentProducts.filter(p => p.category_id == activeCategoryId);
            }

            if (filtered.length === 0) {
                div.innerHTML = '<p style="padding: 20px;">لا توجد أصناف في هذا القسم.</p>';
                return;
            }

            filtered.forEach(prod => {
                div.innerHTML += `
                    <button onclick="addItem(${prod.id})">
                        <div>${prod.name}</div>
                        <span class="price-tag">السعر: ${prod.price}</span>
                        <span class="stock-tag">المتبقي: ${prod.stock_qty}</span>
                    </button>
                `;
            });
        }

        function renderProductsTable() {
            const tbody = document.getElementById('productsTableBody');
            tbody.innerHTML = '';
            currentProducts.forEach(prod => {
                tbody.innerHTML += `
                    <tr>
                        <td>#${prod.id}</td>
                        <td>${prod.category_name || 'بدون قائمة'}</td>
                        <td>${prod.name}</td>
                        <td>${prod.cost_price}</td>
                        <td>${prod.price}</td>
                        <td>${prod.stock_qty} قطعة</td>
                        <td>
                            <button class="btn-orange btn-sm" onclick="openEditProductModal(${prod.id}, ${prod.category_id || "''"}, '${prod.name}', ${prod.cost_price}, ${prod.price}, ${prod.stock_qty})">تعديل / حذف</button>
                        </td>
                    </tr>
                `;
            });
        }

        async function addNewProduct() {
            const category_id = document.getElementById('prodCategory').value;
            const name = document.getElementById('prodName').value;
            const cost_price = document.getElementById('prodCost').value || 0;
            const price = document.getElementById('prodPrice').value;
            const stock_qty = document.getElementById('prodStock').value || 0;

            if (!name || !price) return alert("ادخل اسم وسعر بيع الصنف على الأقل");

            const res = await fetch('index.php?action=add_product', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category_id, name, cost_price, price, stock_qty })
            });
            const data = await res.json();
            if (data.success) {
                document.getElementById('prodName').value = '';
                document.getElementById('prodCost').value = '';
                document.getElementById('prodPrice').value = '';
                document.getElementById('prodStock').value = '';
                currentProducts = data.products;
                renderProductsTable();
                renderProductsButtons();
                alert("تمت إضافة الصنف بنجاح");
            } else {
                alert(data.message || "حدث خطأ أثناء الإضافة");
            }
        }

        function openEditProductModal(id, category_id, name, cost_price, price, stock_qty) {
            document.getElementById('editProdId').value = id;
            document.getElementById('editProdCategory').value = category_id;
            document.getElementById('editProdName').value = name;
            document.getElementById('editProdCost').value = cost_price;
            document.getElementById('editProdPrice').value = price;
            document.getElementById('editProdStock').value = stock_qty;
            document.getElementById('productActionPassword').value = '';
            document.getElementById('editProductModal').style.display = 'flex';
        }

        function closeEditProductModal() {
            document.getElementById('editProductModal').style.display = 'none';
        }

        async function saveProductUpdate() {
            try {
                const id = document.getElementById('editProdId').value;
                const category_id = document.getElementById('editProdCategory').value;
                const name = document.getElementById('editProdName').value;
                const cost_price = document.getElementById('editProdCost').value || 0;
                const price = document.getElementById('editProdPrice').value;
                const stock_qty = document.getElementById('editProdStock').value;
                const password = document.getElementById('productActionPassword').value;

                if (!name || !price) return alert("يرجى إدخال اسم وسعر بيع الصنف");

                const res = await fetch('index.php?action=update_product', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, category_id, name, cost_price, price, stock_qty, password })
                });

                const data = await res.json();
                if (data.success) {
                    currentProducts = data.products;
                    renderProductsTable();
                    renderProductsButtons();
                    closeEditProductModal();
                    loadOpenInvoices();
                    alert("تم تعديل الصنف والقائمة بنجاح");
                } else {
                    alert(data.message);
                }
            } catch (err) {
                alert("حدث خطأ في الاتصال: " + err.message);
            }
        }

        async function confirmDeleteProductWithPassword() {
            try {
                const id = document.getElementById('editProdId').value;
                const password = document.getElementById('productActionPassword').value;

                if (!confirm("هل أنت متأكد من رغبتك في حذف هذا الصنف تماماً؟")) return;

                const res = await fetch('index.php?action=delete_product', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, password })
                });

                const data = await res.json();
                if (data.success) {
                    currentProducts = data.products;
                    renderProductsTable();
                    renderProductsButtons();
                    closeEditProductModal();
                    loadOpenInvoices();
                    alert("تم حذف الصنف بنجاح");
                } else {
                    alert(data.message);
                }
            } catch (err) {
                alert("حدث خطأ في الاتصال: " + err.message);
            }
        }

        async function loadOpenInvoices() {
            await loadCategories();
            const resProd = await fetch('index.php?action=get_products');
            currentProducts = await resProd.json();
            renderPosCategoriesBar();
            renderProductsButtons();

            const res = await fetch('index.php?action=get_open_invoices');
            currentOpenInvoices = await res.json();
            
            const bar = document.getElementById('openInvoicesBar');
            bar.innerHTML = '';

            if (currentOpenInvoices.length === 0) {
                bar.innerHTML = '<span>لا توجد فواتير مفتوحة.</span>';
                document.getElementById('activeInvoiceDetails').innerHTML = 'افتح فاتورة جديدة للبدء.';
                activeInvoiceId = null;
                return;
            }

            if (!activeInvoiceId || !currentOpenInvoices.find(i => i.id == activeInvoiceId)) {
                activeInvoiceId = currentOpenInvoices[0].id;
            }

            currentOpenInvoices.forEach((inv, index) => {
                const borderColor = tableBorderColors[index % tableBorderColors.length];
                const chip = document.createElement('div');
                chip.className = `inv-chip ${inv.id == activeInvoiceId ? 'active' : ''}`;
                chip.style.borderColor = borderColor;
                chip.innerText = inv.invoice_name;
                chip.onclick = () => { activeInvoiceId = inv.id; loadOpenInvoices(); };
                bar.appendChild(chip);
            });

            renderActiveInvoice();
        }

        async function openNewInvoice() {
            const nameInput = document.getElementById('newInvoiceName');
            const res = await fetch('index.php?action=open_invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoice_name: nameInput.value })
            });
            const data = await res.json();
            if (data.success) {
                nameInput.value = '';
                activeInvoiceId = data.invoice.id;
                loadOpenInvoices();
            } else {
                alert(data.message || "حدث خطأ أثناء فتح الفاتورة");
            }
        }

        function openEditInvoiceNameModal() {
            const inv = currentOpenInvoices.find(i => i.id == activeInvoiceId);
            if (!inv) return;
            document.getElementById('updatedInvoiceNameInput').value = inv.invoice_name;
            document.getElementById('editInvoiceNameModal').style.display = 'flex';
        }

        function closeEditInvoiceNameModal() {
            document.getElementById('editInvoiceNameModal').style.display = 'none';
        }

        async function confirmUpdateInvoiceName() {
            const newName = document.getElementById('updatedInvoiceNameInput').value.trim();
            if (!newName) return alert("الرجاء إدخال اسم أو رقم صحيح");

            const res = await fetch('index.php?action=update_invoice_name', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoice_id: activeInvoiceId, invoice_name: newName })
            });
            const data = await res.json();
            if (data.success) {
                closeEditInvoiceNameModal();
                loadOpenInvoices();
            } else {
                alert(data.message || "حدث خطأ أثناء التعديل");
            }
        }

        async function addItem(productId) {
            if (!activeInvoiceId) return alert("افتح فاتورة أولاً!");
            const res = await fetch('index.php?action=add_item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoice_id: activeInvoiceId, product_id: productId })
            });
            const data = await res.json();
            if (data.success) {
                loadOpenInvoices();
            } else {
                alert(data.message);
            }
        }

        async function decreaseItem(productId) {
            const res = await fetch('index.php?action=decrease_item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoice_id: activeInvoiceId, product_id: productId })
            });
            const data = await res.json();
            if (data.success) loadOpenInvoices();
        }

        async function closeInvoice() {
            if (!activeInvoiceId) return;
            const res = await fetch('index.php?action=close_invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoice_id: activeInvoiceId })
            });
            const data = await res.json();
            if (data.success) {
                alert("تمت محاسبة الفاتورة واحتساب أرباحها في السجل بنجاح");
                activeInvoiceId = null;
                loadOpenInvoices();
            } else {
                alert(data.message || "حدث خطأ أثناء إغلاق الفاتورة");
            }
        }

        function openAuthModalForClosedInvoice(invoiceId) {
            selectedClosedInvoiceId = invoiceId;
            document.getElementById('authModalTitle').innerText = `إدارة الفاتورة رقم #${invoiceId}`;
            document.getElementById('authPassInput').value = '';
            document.getElementById('authModal').style.display = 'flex';
        }

        function closeAuthModal() {
            document.getElementById('authModal').style.display = 'none';
        }

        async function handleAuthAction(actionType) {
            const password = document.getElementById('authPassInput').value;

            if (actionType === 'delete') {
                if (confirm("هل أنت متأكد من مسح هذه الفاتورة المغلقة؟")) {
                    const res = await fetch('index.php?action=delete_closed_invoice', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ invoice_id: selectedClosedInvoiceId, password: password })
                    });
                    const data = await res.json();
                    if (data.success) {
                        alert("تم مسح الفاتورة وإعادة الكميات للمستودع بنجاح");
                        closeAuthModal();
                        loadClosedInvoices();
                    } else {
                        alert(data.message);
                    }
                }
                return;
            }

            if (actionType === 'reopen') {
                const res = await fetch('index.php?action=reopen_invoice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ invoice_id: selectedClosedInvoiceId, password: password })
                });
                const data = await res.json();
                if (data.success) {
                    alert("تمت إعادة الفاتورة للعمل.");
                    closeAuthModal();
                    switchTab('pos');
                    activeInvoiceId = selectedClosedInvoiceId;
                    loadOpenInvoices();
                } else {
                    alert(data.message);
                }
            }
        }

        function openReportAuthModal(reportId) {
            selectedReportIdToDelete = reportId;
            document.getElementById('reportIdSpan').innerText = reportId;
            document.getElementById('reportAuthPassInput').value = '';
            document.getElementById('reportAuthModal').style.display = 'flex';
        }

        function closeReportAuthModal() {
            document.getElementById('reportAuthModal').style.display = 'none';
        }

        async function confirmDeleteReport() {
            const password = document.getElementById('reportAuthPassInput').value;
            const res = await fetch('index.php?action=delete_inventory_report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ report_id: selectedReportIdToDelete, password: password })
            });
            const data = await res.json();
            if (data.success) {
                alert("تم حذف تقرير الجرد والأرباح بنجاح");
                closeReportAuthModal();
                loadInventoryReport();
            } else {
                alert(data.message);
            }
        }

        function renderActiveInvoice() {
            const inv = currentOpenInvoices.find(i => i.id == activeInvoiceId);
            if (!inv) return;

            const itemsArray = inv.items || [];

            let itemsHTML = itemsArray.map(i => `
                <tr style="border-bottom:1px solid #fed7aa;">
                    <td style="padding:12px 0;">${i.name}</td>
                    <td>${i.unit_price}</td>
                    <td style="text-align:center;">
                        <button class="btn-sm btn-red" onclick="decreaseItem(${i.product_id})">-</button>
                        <span style="margin:0 12px; font-size:26px; font-weight:900;">${i.qty}</span>
                        <button class="btn-sm btn-green" onclick="addItem(${i.product_id})">+</button>
                    </td>
                    <td>${i.subtotal}</td>
                </tr>
            `).join('');

            let tableWrapper = itemsArray.length ? `
                <table style="width:100%; border:none;">
                    <thead>
                        <tr style="border-bottom:2px solid #fed7aa; text-align:right;">
                            <th>الصنف</th>
                            <th>سعر القطعة</th>
                            <th style="text-align:center;">العدد</th>
                            <th>المجموع</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHTML}</tbody>
                </table>
            ` : '<p>لا توجد طلبات في الفاتورة</p>';
            
            document.getElementById('activeInvoiceDetails').innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                    <p style="margin: 0;"><strong>اسم الطاولة:</strong> ${inv.invoice_name}</p>
                    <button class="btn-orange btn-sm" onclick="openEditInvoiceNameModal()">✏️ تعديل الاسم</button>
                </div>
                <p><strong>وقت الفتح:</strong> ${inv.opened_at}</p>
                <hr>
                ${tableWrapper}
                <hr>
                <h3 style="font-size: 34px; font-weight: 900;">المجموع النهائي: ${inv.total_amount}</h3>
                <button class="btn-green" style="width:100%; font-size:28px; padding: 20px; font-weight: 900;" onclick="closeInvoice()">محاسبة وإغلاق الفاتورة</button>
            `;
        }

        async function loadClosedInvoices() {
            const res = await fetch('index.php?action=get_closed_invoices');
            currentClosedInvoices = await res.json();
            const tableBody = document.getElementById('closedInvoicesTable');
            tableBody.innerHTML = '';

            if (currentClosedInvoices.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا توجد فواتير مغلقة.</td></tr>';
                return;
            }

            currentClosedInvoices.forEach(inv => {
                tableBody.innerHTML += `
                    <tr>
                        <td>#${inv.id}</td>
                        <td>${inv.invoice_name}</td>
                        <td>${inv.opened_at}</td>
                        <td>${inv.closed_at}</td>
                        <td>${inv.total_amount}</td>
                        <td>
                            <button class="btn-orange btn-sm" onclick="viewInvoiceDetails(${inv.id})">عرض الفاتورة</button>
                            <button class="btn-red btn-sm" onclick="openAuthModalForClosedInvoice(${inv.id})">خيارات الإدارة</button>
                        </td>
                    </tr>
                `;
            });
        }

        function viewInvoiceDetails(id) {
            const inv = currentClosedInvoices.find(i => i.id == id);
            if (!inv) return;

            document.getElementById('modalTitle').innerText = `تفاصيل الفاتورة (${inv.invoice_name})`;
            
            const itemsArray = inv.items || [];
            let itemsHTML = itemsArray.map(i => `
                <tr>
                    <td>${i.name}</td>
                    <td>${i.unit_price}</td>
                    <td>${i.qty} قطع</td>
                    <td>${i.subtotal}</td>
                </tr>
            `).join('');
            
            document.getElementById('modalBody').innerHTML = `
                <p><strong>اسم الطاولة:</strong> ${inv.invoice_name}</p>
                <p><strong>وقت الفتح:</strong> ${inv.opened_at}</p>
                <p><strong>وقت المحاسبة:</strong> ${inv.closed_at}</p>
                <hr>
                <h4>الطلبات المباعة بالفاتورة:</h4>
                <table>
                    <thead>
                        <tr><th>الصنف</th><th>سعر القطعة</th><th>العدد المباع</th><th>المجموع</th></tr>
                    </thead>
                    <tbody>${itemsHTML}</tbody>
                </table>
                <h3 style="text-align:left; margin-top:15px; font-size: 34px; font-weight: 900;">المجموع الإجمالي: ${inv.total_amount}</h3>
            `;
            document.getElementById('invoiceModal').style.display = 'flex';
        }

        function closeModal() {
            document.getElementById('invoiceModal').style.display = 'none';
        }

        function setFilter(period) {
            const now = new Date();
            let start = new Date();
            
            if (period === 'today') start = now;
            else if (period === 'week') start.setDate(now.getDate() - 7);
            else if (period === 'month') start.setMonth(now.getMonth() - 1);
            else if (period === 'year') start.setFullYear(now.getFullYear() - 1);

            const formatDate = (d) => d.toISOString().split('T')[0];
            document.getElementById('startDate').value = formatDate(start);
            document.getElementById('endDate').value = formatDate(now);
            
            loadInventoryReport();
        }

        async function loadInventoryReport() {
            const start = document.getElementById('startDate').value;
            const end = document.getElementById('endDate').value;

            const res = await fetch(`index.php?action=get_inventory_report&start=${start}&end=${end}`);
            const data = await res.json();
            lastReportData = data;

            document.getElementById('statTotalSales').innerText = data.total_sales;
            document.getElementById('statTotalProfit').innerText = data.total_profit;
            document.getElementById('statTotalInvoices').innerText = data.total_invoices;
            document.getElementById('statMostSold').innerText = data.most_sold;

            const tbody = document.getElementById('inventoryTableBody');
            tbody.innerHTML = '';

            if (!data.product_stats || data.product_stats.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">لا توجد أصناف أو مبيعات في هذه الفترة.</td></tr>';
            } else {
                data.product_stats.forEach(stat => {
                    tbody.innerHTML += `
                        <tr>
                            <td>${stat.name}</td>
                            <td>${stat.total_qty} قطعة</td>
                            <td>${stat.total_sales}</td>
                            <td style="color: #10b981; font-weight:900;">${stat.total_profit}</td>
                        </tr>
                    `;
                });
            }

            const savedTbody = document.getElementById('savedReportsTableBody');
            savedTbody.innerHTML = '';
            if (!data.saved_reports || data.saved_reports.length === 0) {
                savedTbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">لا توجد جلسات جرد محفوظة مسبقاً.</td></tr>';
            } else {
                data.saved_reports.forEach(r => {
                    savedTbody.innerHTML += `
                        <tr>
                            <td>#${r.id}</td>
                            <td>${r.start_date}</td>
                            <td>${r.end_date}</td>
                            <td>${r.total_sales}</td>
                            <td style="color: #10b981; font-weight:900;">${r.total_profit ?? 0}</td>
                            <td>${r.total_invoices}</td>
                            <td>${r.most_sold}</td>
                            <td>${r.created_at}</td>
                            <td>
                                <button class="btn-red btn-sm" onclick="openReportAuthModal(${r.id})">حذف التقرير</button>
                            </td>
                        </tr>
                    `;
                });
            }
        }

        async function saveCurrentReport() {
            const start = document.getElementById('startDate').value;
            const end = document.getElementById('endDate').value;

            if (!lastReportData || lastReportData.total_invoices === 0) {
                return alert("لا توجد مبيعات في هذه الفترة لتثبيت تقرير الجرد.");
            }

            if (!confirm(`هل تريد تثبيت تقرير الجرد والأرباح بالفترة من ${start} إلى ${end}?`)) return;

            const res = await fetch('index.php?action=save_inventory_report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    start_date: start,
                    end_date: end,
                    total_sales: lastReportData.total_sales,
                    total_profit: lastReportData.total_profit,
                    total_invoices: lastReportData.total_invoices,
                    most_sold: lastReportData.most_sold
                })
            });

            const data = await res.json();
            if (data.success) {
                alert(data.message);
                loadInventoryReport();
            } else {
                alert(data.message || "حدث خطأ أثناء حفظ التقرير");
            }
        }

        loadOpenInvoices();
    </script>
</body>
</html>
