
export interface Env {
    DB: D1Database;
}

interface User {
    email: string;
    password: string;
    salt: string;
    data:string;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        
        const url = new URL(request.url);
        const pathname = url.pathname;

        // 注册接口
        if (pathname === '/api/register' && request.method === 'POST') {
            return this.handleRegister(request, env);
        }
        //请求登录接口
        if (pathname === '/api/login' && request.method === 'POST') 
        {
            return this.handleLogin(request, env);
        }
        return new Response('', { status: 404 });
    },

    async handleRegister(request: Request, env: Env): Promise<Response>
    {
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
                return this.errorResponse(400, 'Email already exists in DB');
            }

            // 生成盐值和密码哈希
            const salt = this.generateSalt();
            const passwordHash = await this.hashPassword(password, salt);

            // 插入新用户
            const { success } = await env.DB.prepare(
                'INSERT INTO PLAYER (email, password, SALT, STIME) VALUES (?, ?, ?, ?)'
            ).bind(email, passwordHash, salt, new Date().toISOString()).run();

            if (success)
            {
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
    generateSalt(): string 
    {
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

    async handleLogin(request: Request, env: Env): Promise<Response> {
    try {
        const { email, password } = await request.json<{ email: string; password: string }>();
        
        // 验证输入
        if (!email || !password) {
            return this.errorResponse(400, 'Email and password are required');
        }

        // 查询用户记录（包含密码哈希和盐值）
        const user = await env.DB.prepare(
            'SELECT email, password, SALT FROM PLAYER WHERE email = ? LIMIT 1'
        ).bind(email).first<User>();

        if (!user) {
            return this.errorResponse(401, 'Invalid email or password');
        }

        // 校验密码
        const isValid = await this.verifyPassword(password, user.password, user.salt);
        
        if (!isValid) 
        {
            return this.errorResponse(401, 'Invalid email or password');
        }

        // 密码验证通过，生成会话令牌或设置Cookie
        return new Response(JSON.stringify({ 
            success: true,
            message: 'Login successful'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return this.errorResponse(500, `Login error: ${error.message}`);
    }
},

// 密码验证方法
async verifyPassword(inputPassword: string, storedHash: string, salt: string): Promise<boolean> {
    // 使用相同的哈希算法处理输入密码
    const inputHash = await this.hashPassword(inputPassword, salt);
    
    // 安全地比较两个哈希值（防止时序攻击）
    return this.secureCompare(inputHash, storedHash);
},

// 安全字符串比较（防止时序攻击）
secureCompare(a: string, b: string): boolean {
    const aBuf = new TextEncoder().encode(a);
    const bBuf = new TextEncoder().encode(b);
    
    if (aBuf.length !== bBuf.length) {
        return false;
    }
    
    let result = 0;
    for (let i = 0; i < aBuf.length; i++) {
        result |= aBuf[i] ^ bBuf[i];
    }
    
    return result === 0;
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
