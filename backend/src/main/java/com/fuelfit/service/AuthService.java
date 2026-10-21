package com.fuelfit.service;

import com.fuelfit.dto.*;
import com.fuelfit.entity.User;
import com.fuelfit.exception.DuplicateEmailException;
import com.fuelfit.repository.UserRepository;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@Profile("!dev")
public class AuthService implements UserDetailsService {
    private final UserRepository users;
    private final PasswordEncoder encoder;
    public AuthService(UserRepository users, PasswordEncoder encoder) {
        this.users = users;
        this.encoder = encoder;
    }
    public UserResponse register(RegisterRequest input) {
        validatePasswordBytes(input.password());
        if (users.existsByEmail(input.email())) throw new DuplicateEmailException();
        try {
            return UserResponse.from(users.saveAndFlush(new User(input.name(), input.email(), encoder.encode(input.password()))));
        } catch (DataIntegrityViolationException ex) {
            // The database constraint also protects against simultaneous registrations.
            if (users.existsByEmail(input.email())) throw new DuplicateEmailException();
            throw ex;
        }
    }
    public UserResponse current(String email) {
        return UserResponse.from(users.findByEmail(email).orElseThrow(() -> new UsernameNotFoundException("Account unavailable")));
    }
    @Override public UserDetails loadUserByUsername(String email) {
        var user = users.findByEmail(email.trim().toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new UsernameNotFoundException("Invalid email or password"));
        return org.springframework.security.core.userdetails.User.withUsername(user.getEmail())
                .password(user.getPasswordHash()).roles(user.getRole().name()).build();
    }
    public static void validatePasswordBytes(String password) {
        // BCrypt's limit is bytes, not characters. Never silently truncate Unicode passwords.
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) throw new IllegalArgumentException();
    }
}
