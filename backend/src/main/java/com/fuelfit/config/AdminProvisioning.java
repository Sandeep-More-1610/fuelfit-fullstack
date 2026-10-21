package com.fuelfit.config;
import java.util.Locale;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.core.env.Environment;
import org.springframework.transaction.support.TransactionTemplate;
// Explicit offline operator action: promotes one existing account, never creates passwords/accounts.
@Component @Profile("admin-provision & !dev")
public class AdminProvisioning implements ApplicationRunner {
 private final JdbcTemplate db; private final Environment env; private final TransactionTemplate tx;
 public AdminProvisioning(JdbcTemplate db,Environment env,TransactionTemplate tx){this.db=db;this.env=env;this.tx=tx;}
 public void run(ApplicationArguments args) {
  String email=env.getRequiredProperty("ADMIN_EMAIL").trim().toLowerCase(Locale.ROOT);
  tx.executeWithoutResult(status->{
   int count=db.update("UPDATE users SET role='ADMIN' WHERE email=?",email);
   if(count!=1)throw new IllegalArgumentException("ADMIN_EMAIL must identify exactly one existing account");
  });
  System.out.println("Administrator provisioning completed. Sign in again to obtain the ADMIN role.");
 }
}
