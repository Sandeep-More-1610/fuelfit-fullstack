-- Additive catalog tables; existing users and unrelated tables remain untouched.
CREATE TABLE categories (
 id VARCHAR(40) PRIMARY KEY, name VARCHAR(100) NOT NULL, description VARCHAR(500) NOT NULL
);
CREATE TABLE products (
 id VARCHAR(40) PRIMARY KEY, category_id VARCHAR(40) NOT NULL,
 name VARCHAR(150) NOT NULL, description VARCHAR(4000) NOT NULL,
 price DECIMAL(12,2) NOT NULL CHECK (price >= 0), image VARCHAR(1500) NOT NULL,
 sizes TEXT NOT NULL, colors TEXT NOT NULL,
 featured BOOLEAN NOT NULL DEFAULT FALSE, active BOOLEAN NOT NULL DEFAULT TRUE,
 version BIGINT NOT NULL DEFAULT 0,
 FOREIGN KEY (category_id) REFERENCES categories(id)
);
CREATE INDEX idx_products_category_active ON products(category_id, active);
CREATE TABLE inventory (
 product_id VARCHAR(40) PRIMARY KEY, quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
 version BIGINT NOT NULL DEFAULT 0,
 FOREIGN KEY (product_id) REFERENCES products(id)
);
