V1.0 

```
▶ Auth Controller
  ▶ register
    ✔ should register a new user successfully (2.0628ms)
    ✔ should default role to operator if not provided (0.532ms)
    ✔ should return 400 if email already exists (0.4988ms)
    ✔ should handle validation errors (2.5861ms)
    ✔ should call next with error for non-validation errors (1.0693ms)
  ✔ register (8.171ms)
  ▶ login
    ✔ should login user successfully (0.8563ms)
    ✔ should return 400 if email is missing (0.3268ms)
    ✔ should return 400 if password is missing (0.432ms)
    ✔ should return 401 if user not found (0.5723ms)
    ✔ should return 401 if user is deactivated (0.5141ms)
    ✔ should return 401 if password does not match (0.448ms)
    ✔ should update lastLogin on successful login (0.4292ms)
    ✔ should call next with error on exception (0.408ms)
  ✔ login (4.7991ms)
  ▶ getMe
    ✔ should return current user (1.1287ms)
    ✔ should return 404 if user not found (0.3542ms)
    ✔ should call next with error on exception (0.4004ms)
  ✔ getMe (2.0879ms)
  ▶ updateProfile
    ✔ should update user profile successfully (1.8227ms)
    ✔ should update only fullName if only fullName provided (0.4803ms)
    ✔ should update only email if only email provided (1.163ms)
    ✔ should return 400 if email already in use (0.8629ms)
    ✔ should call next with error for other errors (0.7663ms)
  ✔ updateProfile (5.5574ms)
  ▶ changePassword
    ✔ should change password successfully (0.7796ms)
    ✔ should return 400 if currentPassword is missing (0.4539ms)
    ✔ should return 400 if newPassword is missing (0.623ms)
    ✔ should return 400 if newPassword is too short (0.7232ms)
    ✔ should return 401 if current password is incorrect (1.0032ms)
    ✔ should call next with error on exception (0.905ms)
  ✔ changePassword (5.0631ms)
✔ Auth Controller (26.6966ms)
▶ Auth Middleware
  ▶ protect
    ✔ should call next and attach user on valid token (3.9745ms)
    ✔ should return 401 if no token provided (0.4542ms)
    ✔ should return 401 if authorization header does not start with Bearer (0.51
12ms)
    ✔ should return 401 if token is expired (0.6549ms)
    ✔ should return 401 if token is invalid (0.7524ms)
    ✔ should return 401 if user not found (0.407ms)
    ✔ should return 401 if user is deactivated (2.5595ms)
    ✔ should call next with error for unexpected errors (0.577ms)
  ✔ protect (11.7561ms)
  ▶ authorize
    ✔ should call next if user has authorized role (0.66ms)
    ✔ should call next if user role is one of multiple allowed roles (0.4637ms)
    ✔ should return 401 if no user on request (0.2912ms)
    ✔ should return 403 if user role is not authorized (0.2721ms)
  ✔ authorize (2.0793ms)
  ▶ adminOnly
    ✔ should call next if user is admin (0.3578ms)
    ✔ should return 401 if no user on request (0.268ms)
    ✔ should return 403 if user is operator (0.2673ms)
    ✔ should return 403 if user is viewer (0.2414ms)
  ✔ adminOnly (1.3544ms)
  ▶ canModify
    ✔ should call next if user is admin (0.3702ms)
    ✔ should call next if user is operator (0.2653ms)
    ✔ should return 401 if no user on request (0.2415ms)
    ✔ should return 403 if user is viewer (0.255ms)
  ✔ canModify (1.3515ms)
✔ Auth Middleware (17.5989ms)
```
