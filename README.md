# TraderLion Platform Backend

## API Documentation

Swagger UI is available in non-production environments:

```
http://localhost:3000/api-docs
```

### Accessing Swagger

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000/api-docs
   ```

### Documented Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /auth/signup | None | User registration |
| POST | /auth/login | None | User login |
| POST | /auth/logout | None | User logout |
| GET | /auth/me | Cookie | Get current user |
| GET | /auth/google | None | Initiate Google OAuth |
| GET | /auth/google/callback | None | Google OAuth callback |
| POST | /auth/forgot-password | None | Request password reset OTP |
| POST | /auth/forgot-password/verify | None | Verify OTP |
| POST | /auth/forgot-password/reset | None | Reset password |

### Authentication

This API uses **cookie-based session authentication**. The session cookie is:
- HttpOnly (not accessible via JavaScript)
- Set automatically on successful login/signup
- Cleared on logout

Protected routes (marked with Cookie auth) require a valid session cookie.
