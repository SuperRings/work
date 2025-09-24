
import { Env } from './env-types';
import { WorkerMailer } from 'worker-mailer'
// let DB: D1Database;

// 连接到 SMTP 服务器
const mailer = await WorkerMailer.connect({
  credentials: {
    username: 'runring@runring.eu.org',
    password: 'SNdmQsJLrIttT35N',
  },
  authType: 'plain',
  host: 'smtp.qiye.aliyun.com',
  port: 25,
  secure: true,
})

interface User {
    email: string;
    password: string;
    data:Blob;
    deviceid:string;
    key:string;
    ETIME:string;
    ATTIME:string;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        // DB=env.DB;
        const url = new URL(request.url);
        const pathname = url.pathname;
        // const ip = request.headers.get('cf-connecting-ip') || 
        //     request.headers.get('x-forwarded-for');
        // // 跳过对未知IP的限制（可选）
        // if (ip === 'unknown-ip')
        // {
        //     // 可以选择直接拒绝或放行
        //     return new Response('无法识别客户端IP', { status: 400 });
        // }
        // 注册接口
        if (pathname === '/api/regsiter' && request.method === 'POST') //register
        {
            return this.handleRegister(request, env);
        }
        //请求登录接口
        if (pathname === '/api/lgoin' && request.method === 'POST') //login
        {
            return this.handleLogin(request, env);
        }
        //数据上传接口
        if (pathname === '/api/seadata' && request.method === 'POST') //setdata
        {
            return this.handledata(request, env);
        }
        //
        if (pathname === '/api/sedmail' && request.method === 'POST') //setdata
        {
            return this.handledata(request, env);
        }
        //数据下载接口
        // if (pathname === '/api/gesdata' && request.method === 'POST') //getdata
        // {
        //     return this.handgetata(request, env);
        // }
        // if (pathname === '/api/gattime' && request.method === 'POST') //time
        // {
        //     return this.handgetata(request, env);
        // }

        return new Response('', { status: 404 });
    },

    async handleRegister(request: Request, env: Env): Promise<Response>
    {
        // DB=env.DB;
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
            const domain = email.split('@')[1].toLowerCase();
            const allowedDomains = ['gmail.com', '163.com', 'qq.com','runring.eu.org','outlook.com','icloud.com'];
            if (!allowedDomains.includes(domain)) {
                // 域名不在允许列表中
                return new Response(JSON.stringify({ error: 'Email domain not allowed.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                });
            }
            const dbs = [
                env.DB, env.DB1, env.DB2
            ];
            const MAX_ROWS_PER_DB = 100000;
            let targetDb = null;
            let selectedDbIndex = -1;

            // 第一步：检查邮箱是否在所有数据库中已存在
            for (let i = 0; i < dbs.length; i++)
            {
                // const cachedCount = await env.KV.get(`db${i}_count`);
                const db = dbs[i];
                const existingUser = await db.prepare(
                    'SELECT 1 FROM PLAYER WHERE email = ? LIMIT 1;'
                ).bind(email).first();
                if (existingUser)
                {
                    return this.errorResponse(400, 'Email already exists in database');
                }
            }
            // // 检查邮箱是否已存在
            // const existingUser = await DB.prepare(
            //   'SELECT 1 FROM PLAYER WHERE email = ? LIMIT 1;'
            // ).bind(email).first();
            // if (existingUser) 
            // {
            //     return this.errorResponse(400, 'Email already exists in DB');
            // }
            // 第二步：查找未满的数据库
            for (let i = 0; i < dbs.length; i++)
            {
                const db = dbs[i];
                // 检查当前数据库的行数
                const countResult = await db.prepare('SELECT COUNT(*) as count FROM PLAYER').first() as { count: number } | null;
                const rowCount = countResult ? countResult.count : 0;
                if (rowCount < MAX_ROWS_PER_DB)
                {
                    targetDb = db;
                    selectedDbIndex = i;
                    break;
                }
            }
            if (!targetDb) {
                return this.errorResponse(503, 'All databases are full. Cannot register new user.');
            }

            const binaryData = new Uint8Array([123]); 
            const randomStr = crypto.randomUUID();
            // 插入新用户
            const { success } = await targetDb.prepare(
                'INSERT INTO PLAYER (email, password, STIME, DATA, KEY) VALUES (?, ?, ?, ?, ?)'
            ).bind(email, password, new Date().toISOString(),binaryData,randomStr).run();

            // 发送邮件
            await mailer.send({
            from: { name: 'ringstudio', email: 'runring@runring.eu.org' },
            to: { name: 'Alice', email: email },
            subject: '来自 Worker Mailer 的问候',
            text: '这是一条纯文本消息',
            html: '<h1>你好</h1><p>这是一条 HTML 消息</p>',
            })

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

    async handleLogin(request: Request, env: Env): Promise<Response>
    {
    // DB=env.DB;
    try {
        const { email, password,deviceid} = await request.json<{ 
            email: string; 
            password: string;
            deviceid: string;
        }>();

        // 2. 基础验证
        if (!email || !password) {
            return this.errorResponse(400, 'The mailbox and password are empty.');
        }

        const dbs = [
            env.DB, env.DB1, env.DB2
        ];

      // 并行在所有数据库中查询该邮箱
        const queryPromises = dbs.map(db => 
            db.prepare('SELECT email, password, KEY FROM PLAYER WHERE email = ? LIMIT 1')
              .bind(email)
              .first<{ email: string; password: string; KEY:string }>()
        );
        const results = await Promise.all(queryPromises);
        // 查找存在的用户
        let targetDb = null;
        let user = null;
        let dbIndex = -1;
        for (let i = 0; i < results.length; i++) {
            if (results[i] !== null) {
                user = results[i];
                targetDb = dbs[i];
                dbIndex = i;
                break;
            }
        }

        // 如果所有数据库都没有找到该邮箱
        if (!user) {
            return this.errorResponse(401, 'Wrong mailbox or password.');
        }
        if(!targetDb)
        {
            return this.errorResponse(401, 'Wrong mailbox or password.');
        }

        // 验证密码（这里假设密码是明文，实际应该用哈希比较）
        if (user.password !== password) {
            return this.errorResponse(401, 'Wrong mailbox or password.');
        }
        // const user = await DB.prepare(
        //     `SELECT email, password FROM PLAYER WHERE email = ? LIMIT 1`
        // ).bind(email).first<{
        //     email: string;
        //     password: string;
        // }>();
        //  for (let i = 0; i < results.length; i++) {
        //     if (results[i] !== null) {
        //         user = results[i];
        //         targetDb = dbs[i];
        //         dbIndex = i;
        //         break;
        //     }
        // }

        const { success } = await targetDb.prepare(
        'UPDATE PLAYER SET DEVICEID = ? , ATTIME = ? WHERE email = ?'
        ).bind(deviceid, new Date().toISOString(), email).run();

        const result = await targetDb.prepare(
        'SELECT DATA FROM PLAYER WHERE email = ?'
        ).bind(email).first();
        if (!result)
        {
            return new Response('Data not found', { status: 404 });
        }
        return new Response(JSON.stringify({
            success: true,
            email: user.email,
            message: 'Login!',
            time: new Date().toISOString(),
            mdata: result,
            key: user.KEY,
            key0:"0",//runring@runring.eu.org
            key1: "1",//SNdmQsJLrIttT35N
            key2:"2",//smtp.qiye.aliyun.com
            key3: 25
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error:any) {
        return this.errorResponse(500, `服务器错误: ${error.message}`);
    }
},
async handledata(request: Request, env: Env): Promise<Response> {//setdata
    // DB=env.DB;
    try {
        const { email,deviceid,data} = await request.json<{ 
            email: string; 
            deviceid:string;
            data:Blob;
        }>();


        const dbs = [
            env.DB, env.DB1, env.DB2
        ];

      // 并行在所有数据库中查询该邮箱
        const queryPromises = dbs.map(db => 
            db.prepare('SELECT email, password FROM PLAYER WHERE email = ? LIMIT 1')
              .bind(email)
              .first<{ email: string; password: string }>()
        );
        const results = await Promise.all(queryPromises);
        // 查找存在的用户
        let targetDb = null;
        let user = null;
        let dbIndex = -1;

        for (let i = 0; i < results.length; i++) {
            if (results[i] !== null) {
                user = results[i];
                targetDb = dbs[i];
                dbIndex = i;
                break;
            }
        }

        if (!user) {
            return this.errorResponse(401, 'Wrong mailbox or password.');
        }
        if(!targetDb)
        {
            return this.errorResponse(401, 'Wrong mailbox or password.');
        }

        user = await targetDb.prepare(
            `SELECT email, DEVICEID FROM PLAYER WHERE email = ? AND DEVICEID = ? LIMIT 1`
        ).bind(email,deviceid).first<{
            email: string;
            deviceid:string;
        }>();

        if (!user)
        {
            return this.errorResponse(401, 'Account offline!');
        }
        const { success } = await targetDb.prepare(
        'UPDATE PLAYER SET DATA = ? WHERE email = ?'
        ).bind(data, email).run();
        // 7. 登录成功响应
        return new Response(JSON.stringify({
            success: true,
            email: user.email,
            message: '成功',
            time: new Date().toISOString()
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error:any) {
        return this.errorResponse(500, `Server error: ${error.message}`);
    }
},

// async handgetata(request: Request, env: Env): Promise<Response> {//get data
//         // DB=env.DB;
//     try {
//         const { email,deviceid,data} = await request.json<{ 
//             email: string; 
//             deviceid:string;
//             data:Blob;
//         }>();

//         const user = await DB.prepare(
//             `SELECT email, DEVICEID FROM PLAYER WHERE email = ? AND DEVICEID = ? LIMIT 1`
//         ).bind(email,deviceid).first<{
//             email: string;
//             deviceid:string;
//         }>();

//         if (!user)
//         {
//             return this.errorResponse(401, 'Account offline!');
//         }
//         const { success } = await DB.prepare(
//         'UPDATE PLAYER SET DATA = ? WHERE email = ?'
//         ).bind(data, email).run();

//         return new Response(JSON.stringify({
//             success: true,
//             email: user.email,
//             message: '成功'
//         }), {
//             status: 200,
//             headers: { 'Content-Type': 'application/json' }
//         });

//     } catch (error:any) {
//         return this.errorResponse(500, `Server error: ${error.message}`);
//     }
// },
async handgettime(request: Request, env: Env): Promise<Response> {//get data
        // DB=env.DB;
    try {

        return new Response(JSON.stringify({
            success: true,
            message: '成功',
            time: new Date().toISOString()
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error:any) {
        return this.errorResponse(500, `Server error: ${error.message}`);
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
