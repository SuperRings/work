
export interface Env {
    DB: D1Database;
}

interface User {
    email: string;
    password: string;
    data:Blob;
    deviceid:string;
    activity:string;
    key:string;
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

            // 插入新用户
            const { success } = await env.DB.prepare(
                'INSERT INTO PLAYER (email, password, STIME) VALUES (?, ?, ?, ?)'
            ).bind(email, password, new Date().toISOString()).run();

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


    // 验证邮箱格式
    validateEmail(email: string): boolean {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    async handleLogin(request: Request, env: Env): Promise<Response> {
    try {
        const { email, password,deviceid} = await request.json<{ 
            email: string; 
            password: string;
            deviceid:string;
        }>();

        // 2. 基础验证
        if (!email || !password) {
            return this.errorResponse(400, '邮箱和密码不能为空');
        }

        // 3. 查询用户数据（包含密码哈希和盐值）
        const user = await env.DB.prepare(
            `SELECT email, password FROM PLAYER WHERE email = ? LIMIT 1`
        ).bind(email).first<{
            email: string;
            password: string;
        }>();

        // 4. 用户不存在或密码错误（统一返回相同错误信息防止枚举攻击）
        if (!user) 
        {
            return this.errorResponse(401, '邮箱或密码错误1');
        }
        const { success } = await env.DB.prepare(
        'UPDATE PLAYER SET deviceid = ? WHERE email = ?'
        ).bind(deviceid, email).run();
        // 7. 登录成功响应
        return new Response(JSON.stringify({
            success: true,
            email: user.email,
            message: '登录成功'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error:any) {
        return this.errorResponse(500, `服务器错误: ${error.message}`);
    }
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

function xorStrings(str1: string, str2: string) {
  let result = '';
  for (let i = 0; i < str1.length; i++) {
    const charCode = str1.charCodeAt(i) ^ str2.charCodeAt(i % str2.length);
    result += String.fromCharCode(charCode);
  }
  return result;
}