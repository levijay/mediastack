export interface User {
    id: string;
    username: string;
    email: string;
    password_hash: string;
    role: 'admin' | 'approver' | 'user';
    is_active: number;
    request_limit_movies: number;
    request_limit_tv: number;
    api_key: string | null;
    created_at: string;
    updated_at: string;
}
export interface CreateUserDTO {
    username: string;
    email: string;
    password: string;
    role?: 'admin' | 'approver' | 'user';
}
export declare class UserModel {
    static create(data: CreateUserDTO): Promise<User>;
    static findById(id: string): User | undefined;
    static findByUsername(username: string): User | undefined;
    static findByEmail(email: string): User | undefined;
    static findByApiKey(apiKey: string): User | undefined;
    static findAll(): User[];
    static update(id: string, data: Partial<User>): User | undefined;
    static delete(id: string): boolean;
    static count(): number;
}
//# sourceMappingURL=User.d.ts.map