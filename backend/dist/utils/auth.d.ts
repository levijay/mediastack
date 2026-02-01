export interface JWTPayload {
    userId: string;
    username: string;
    role: string;
}
export declare function generateToken(payload: JWTPayload): string;
export declare function verifyToken(token: string): JWTPayload;
export declare function hashPassword(password: string): Promise<string>;
export declare function comparePassword(password: string, hash: string): Promise<boolean>;
export declare function generateApiKey(): string;
//# sourceMappingURL=auth.d.ts.map