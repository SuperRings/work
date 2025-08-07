export interface Env {
    DB: D1Database;
}

interface User {
    email: string;
    password: string;
    salt: string;
    ETIME: string;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const pathname = url.pathname;

        // 注册接口
        if (pathname === '/api/register' && request.method === 'POST') {
            return this.handleRegister(request, env);
        }

        return new Response('Not Found', { status: 404 });
    },

    async handleRegister(request: Request, env: Env): Promise<Response> {
        try {
            // 解析请求体
            const requestBody = await request.json<{ email: string; password: string }>();
            const { email, password } = requestBody;

            // 验证输入
            if (!email || !password) {
                return this.errorResponse(400, 'Email and password are required');
            }

            // 验证邮箱格式
            if (!this.validateEmail(email)) {
                return this.errorResponse(400, 'Invalid email format');
            }

            // 检查邮箱是否已存在
            const existingUser = await env.DB.prepare(
              'SELECT 1 FROM PLAYER WHERE email = ? LIMIT 1;'
            ).bind(email).first();

            if (existingUser) {
                return this.errorResponse(400, 'Email already exists');
            }

            // 生成盐值和密码哈希
            const salt = this.generateSalt();
            const passwordHash = await this.hashPassword(password, salt);

            // 插入新用户
            const { success } = await env.DB.prepare(
                'INSERT INTO PLAYER (email, password, SALT, ETIME) VALUES (?, ?, ?, ?)'
            ).bind(email, passwordHash, salt, new Date().toISOString()).run();

            if (success) {
                return new Response(JSON.stringify({ 
                    success: true, 
                    message: 'User registered successfully' 
                }), { 
                    status: 201,
                    headers: { 'Content-Type': 'application/json' }
                });
            } else {
                return this.errorResponse(500, 'Failed to register user');
            }
        } catch (error: any) {
            return this.errorResponse(500, `Error: ${error.message}`);
        }
    },

    // 生成随机盐值
    generateSalt(): string {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    },

    // 密码哈希处理
    async hashPassword(password: string, salt: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + salt);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    // 验证邮箱格式
    validateEmail(email: string): boolean {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    // 错误响应辅助函数
    errorResponse(status: number, message: string): Response {
        return new Response(JSON.stringify({ 
            success: false, 
            message: message 
        }), { 
            status: status,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};