const jwt =
    require("jsonwebtoken");

function authenticateToken(
    req,
    res,
    next
) {
    const authorization =
        req.headers.authorization;

    if (!authorization) {
        return res.status(401).json({
            error:
                "Authentication required"
        });
    }

    const parts =
        authorization.split(" ");

    if (
        parts.length !== 2 ||
        parts[0] !== "Bearer"
    ) {
        return res.status(401).json({
            error:
                "Invalid authorization header"
        });
    }

    try {
        req.user =
            jwt.verify(
                parts[1],
                process.env.JWT_SECRET
            );

        next();
    } catch (error) {
        return res.status(401).json({
            error:
                "Invalid or expired token"
        });
    }
}

function requireRole(
    ...allowedRoles
) {
    return function (
        req,
        res,
        next
    ) {
        if (
            !req.user ||
            !allowedRoles.includes(
                req.user.role
            )
        ) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        next();
    };
}

module.exports = {
    authenticateToken,
    requireRole
};
