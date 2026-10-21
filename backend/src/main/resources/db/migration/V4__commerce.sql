-- Additive migration. Never alters the existing users, catalog or inventory data.
CREATE TABLE carts (
 user_id BIGINT PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0,
 FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE cart_items (
 id VARCHAR(40) PRIMARY KEY, user_id BIGINT NOT NULL, product_id VARCHAR(40) NOT NULL,
 size_option VARCHAR(100) NOT NULL, color_option VARCHAR(100) NOT NULL,
 quantity INT NOT NULL CHECK (quantity BETWEEN 1 AND 99),
 UNIQUE (user_id,product_id,size_option,color_option),
 FOREIGN KEY (user_id) REFERENCES carts(user_id), FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE TABLE cart_merges (
 user_id BIGINT NOT NULL, merge_key VARCHAR(36) NOT NULL, PRIMARY KEY(user_id,merge_key),
 FOREIGN KEY(user_id) REFERENCES carts(user_id)
);
CREATE TABLE addresses (
 id VARCHAR(40) PRIMARY KEY, user_id BIGINT NOT NULL,
 name VARCHAR(100) NOT NULL, phone VARCHAR(20) NOT NULL, line1 VARCHAR(200) NOT NULL,
 line2 VARCHAR(200) NOT NULL, city VARCHAR(100) NOT NULL, state VARCHAR(100) NOT NULL,
 postal_code VARCHAR(10) NOT NULL, country VARCHAR(2) NOT NULL,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE INDEX idx_addresses_user ON addresses(user_id);
CREATE TABLE wishlist_items (
 user_id BIGINT NOT NULL, product_id VARCHAR(40) NOT NULL, PRIMARY KEY(user_id,product_id),
 FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(product_id) REFERENCES products(id)
);
CREATE TABLE orders (
 id VARCHAR(40) PRIMARY KEY, user_id BIGINT NOT NULL, order_number VARCHAR(50) NOT NULL UNIQUE,
 status VARCHAR(20) NOT NULL CHECK(status IN ('PLACED','CONFIRMED','SHIPPED','DELIVERED','CANCELLED')),
 payment_method VARCHAR(20) NOT NULL CHECK(payment_method='COD'),
 payment_status VARCHAR(20) NOT NULL CHECK(payment_status IN ('PENDING','COLLECTED','CANCELLED')),
 currency VARCHAR(3) NOT NULL, subtotal DECIMAL(14,2) NOT NULL CHECK(subtotal>=0),
 shipping DECIMAL(14,2) NOT NULL CHECK(shipping>=0), total DECIMAL(14,2) NOT NULL CHECK(total>=0),
 address_json TEXT NOT NULL, idempotency_key VARCHAR(36) NOT NULL, request_hash VARCHAR(64) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(user_id,idempotency_key), FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE INDEX idx_orders_user_created ON orders(user_id,created_at);
CREATE INDEX idx_orders_status_created ON orders(status,created_at);
CREATE TABLE order_items (
 id VARCHAR(40) PRIMARY KEY, order_id VARCHAR(40) NOT NULL, product_id VARCHAR(40) NOT NULL,
 name VARCHAR(150) NOT NULL, image VARCHAR(1500) NOT NULL,
 size_option VARCHAR(100) NOT NULL, color_option VARCHAR(100) NOT NULL,
 unit_price DECIMAL(12,2) NOT NULL CHECK(unit_price>=0), quantity INT NOT NULL CHECK(quantity BETWEEN 1 AND 99),
 line_total DECIMAL(14,2) NOT NULL CHECK(line_total>=0),
 FOREIGN KEY(order_id) REFERENCES orders(id), FOREIGN KEY(product_id) REFERENCES products(id)
);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE TABLE newsletter_subscribers (
 email VARCHAR(254) PRIMARY KEY, subscribed BOOLEAN NOT NULL,
 consent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
