---
title: JWT概念及其面试题
date: 2026-06-27 12:00:00
tag:
  - Backend
description: 今天开始正式开始更后端系列的文章
---
# JWT
JWT(Json Web Token)是一种用于身份认证和授权的token格式，在后端场景中经常可以看到它的身影。用户登录之后，服务端会签发一个JWT token，之后用户的请求都会带着这个token,用于判断用户的身份。
## JWT的结构
JWT由三部分组成，每部分之间由小数点隔开，我们一般看到的就是xxxxx.yyyyy.zzzzz，三个部分其实依次是Header.Payload.Signature。
Header描述 Token 类型和签名算法，比如:
{
  "alg": "HS256",
  "typ": "JWT"
}
alg是签名算法，常见的有HS256：HMAC + SHA-256，对称密钥,RS256：RSA + SHA-256，非对称密钥。
typ = type，表示 Token 类型，通常是 JWT
Payload是载荷，用来存放声明，也就是Claims，常见的Claims的标准字段有:
| Claim | 含义              | 说明                    |
| ----- | --------------- | --------------------- |
| `iss` | Issuer          | 签发者                   |
| `sub` | Subject         | 主题，通常是用户 ID           |
| `aud` | Audience        | 接收方，表示这个 Token 给谁用    |
| `exp` | Expiration Time | 过期时间                  |
| `nbf` | Not Before      | 在此时间之前不可用             |
| `iat` | Issued At       | 签发时间                  |
| `jti` | JWT ID          | Token 唯一标识，可用于防重放或黑名单 |
当然我们也可以写一些自定义的Claim，比如：
{
  "sub": "10001",
  "username": "alice",
  "role": "admin",
  "iat": 1710000000,
  "exp": 1710003600
}
这里自定义了username和role，用来表示用户名和权限。
需要特别注意的是，Payload并不是加密的，而是Base64编码，因此不要把敏感信息写进Payload中。那刚才的加密算法是做什么用的呢？签名生成。
Signature用于验证 JWT 是否被篡改，其典型生成逻辑为:
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  secret
)
服务端是有密钥的，拿到JWT后会进行签名的校验。如果内容被修改，那么用密钥算出来的签名一定是不一样的。
## JWT的认证流程
典型流程如下：

1.用户登录，提交用户名和密码。
2.服务端验证成功后，生成 JWT。
3.服务端把 JWT 返回给客户端。
4.客户端保存 JWT。
5.后续请求中，客户端携带 JWT，例如：
Authorization: Bearer &lt;token&gt;
6.服务端收到请求后，校验 JWT 的签名、过期时间、签发者、接收方等。
7.校验通过后，从 Payload 中取出用户 ID、角色等信息，完成认证和授权。

重点是：JWT 常用于无状态认证。服务端不一定需要保存用户 Session，只要能验证 Token 的签名，就能判断 Token 是否可信。

## JWT的优缺点

### 优点
首先，JWT是无状态的，不需要像Session那样存储大量数据，适合分布式系统和微服务。比如当前有3个Server A、B、C，之前的Session建立在A的话，后面的请求可能会通过负载均衡到B，这样就会导致无法认证，因为B没有数据，而JWT的话，只要三方都有同一套验证体系即可。
其次，JWT跨域友好，可以放在请求头里，适合前后端分离、移动端、第三方 API 调用等场景。
同时JWT具有自包含能力，可以携带用户 ID、角色、权限、租户 ID 等信息，服务端可以减少数据库查询。
最后就是JWT比较适合单点登录，可以在多个系统之间传递身份信息，常见于 SSO、OAuth2、OpenID Connect 等体系中。
### 缺点
JWT不容易主动失效，假如说当前一个用户退出登录或者账号被封禁了，但是JWT还没有过期，这就会导致问题。
然后就是上面提到过的，JWT不是加密的，Payload里不能存放敏感数据。

## 如何解决JWT不容易主动失效的问题？
### 使用黑名单机制
JWT中的jti是其唯一标识，在退出登陆时，可以把这个jti写进redis中，每次请求验签通过后，多查一步黑名单，命中则拒绝。
这里有个小技巧是:黑名单条目的 TTL = token 剩余有效期（exp - now），到期 Redis自动清理，黑名单永远只装"已退出但还没自然过期"的 token，体积很小。
可能的伪代码是这样的:

  // 退出登录
  public void logout(String token) {
      Claims claims = parse(token);
      String jti = claims.getId();
      long ttl = claims.getExpiration().getTime() - System.currentTimeMillis();
      if (ttl > 0) {
          redis.setex("jwt:blacklist:" + jti, ttl / 1000, "1");
      }
  }

  // 请求拦截器：验签通过后再查黑名单
  public boolean validate(String token) {
      Claims claims = parse(token);            // 1. 验签 + 验 exp
      String jti = claims.getId();
      return !redis.hasKey("jwt:blacklist:" + jti);  // 2. 不在黑名单才放行
  }
- ✅ 能精确退出单个 token，实现简单，应用最广
- ❌ 每次请求多一次 Redis 查询，牺牲了一点"无状态"（但 Redis 很快、黑名单很小，可接受）
### 使用白名单机制
是黑名单的反向实现思路，存储所有有效的token，退出登录时即将token从名单中删除，但存储量大、几乎退化成 Session，无状态优势所剩无几。一般不如黑名单划算。

### access token + refresh token
既然access token是无状态的，不好弄它，那就让它的存活时间尽可能的短，比如几分钟，然后再加入一个refresh token，时间可以设置的长一些，比如几天这种，在refresh token存活的时间里，access token会不断的被刷新，退出登录后refresh token被移除，access token在很短的时间内会自然过期。
这种做法是大型系统的标准架构，但是注意的是这种方法不能让access token瞬间失效。
### 更改版本号
这个方法更适用于退出所有设备或者更改密码下线的情景。比如说你用相同的账号密码同时登录了手机、ipad、电脑，这个时候你在其中一端更改了密码，这个时候需要3端同时下线，这个时候就可以采取更改版本号的方式。
token里添加一个version字段，退出 / 改密码 / 强制下线时，version + 1，该用户所有已签发的 token 一次性全部作废。

### 组合拳
实际使用中，我们可以综合一下上述几种办法:
  整套方案的核心，是为 token 装上三个粒度不同的失效开关，各管一类场景：

  ┌─────────────────────────────────────────────────────────┐
  │  ① 短 exp        —— 时间维度：兜底，token 自然过期          │
  │  ② 黑名单(jti)   —— token 维度：单设备即时退出              │
  │  ③ 版本号(uid)   —— 用户维度：全设备即时退出 / 改密 / 封号  │
  │  ④ refresh 记录  —— 设备维度：阻止"继续换新 token"          │
  └─────────────────────────────────────────────────────────┘

  access token 负责"高频、无状态的业务请求校验"，refresh token 负责"低频、有状态的续期"，两者职责分离。

  Token 的 Claim 设计

  ┌───────┬──────────────────┬───────────────┬───────────────────────────┐
  │ Claim │   Access Token   │ Refresh Token │           说明            │
  ├───────┼──────────────────┼───────────────┼───────────────────────────┤
  │ sub   │ userId           │ userId        │ 用户 ID                   │
  ├───────┼──────────────────┼───────────────┼───────────────────────────┤
  │ jti   │ 唯一 ID          │ 唯一 ID       │ 黑名单 / rotation 的 key  │
  ├───────┼──────────────────┼───────────────┼───────────────────────────┤
  │ did   │ deviceId         │ deviceId      │ 设备标识，区分多端        │
  ├───────┼──────────────────┼───────────────┼───────────────────────────┤
  │ ver   │ 签发时的用户版本 │ —             │ 全局失效比对用            │
  ├───────┼──────────────────┼───────────────┼───────────────────────────┤
  │ type  │ "access"         │ "refresh"     │ 防止 refresh 当 access 用 │
  ├───────┼──────────────────┼───────────────┼───────────────────────────┤
  │ exp   │ 15 分钟          │ 7 天          │ 短/长有效期               │
  └───────┴──────────────────┴───────────────┴───────────────────────────┘

  Redis 存储设计

  ┌─────────────────────────────┬─────────────────┬───────────────┬─────────────────────────────────────────────────┐
  │             Key             │      Value      │      TTL      │                      作用                       │
  ├─────────────────────────────┼─────────────────┼───────────────┼─────────────────────────────────────────────────┤
  │ auth:uver:{userId}          │ 整数版本号      │ 长期/无       │ ③ 全局失效总闸                                  │
  ├─────────────────────────────┼─────────────────┼───────────────┼─────────────────────────────────────────────────┤
  │ auth:rt:{userId}:{deviceId} │ 当前 refresh 的 │ = refresh     │ ④ 校验/撤销 refresh，支持 rotation              │
  │                             │  jti            │ 有效期        │                                                 │
  ├─────────────────────────────┼─────────────────┼───────────────┼─────────────────────────────────────────────────┤
  │ auth:bl:{jti}               │ 1               │ = access      │ ② 单设备 access 即时拉黑                        │
  │                             │                 │ 剩余有效期    │                                                 │
  ├─────────────────────────────┼─────────────────┼───────────────┼─────────────────────────────────────────────────┤
  │ auth:devs:{userId}          │ Set&lt;deviceId&gt; │ 长期          │ 记录该用户活跃设备，全局退出时批量删 refresh    │
  │                             │                 │               │ 用（避免 KEYS/SCAN）                            │
  └─────────────────────────────┴─────────────────┴───────────────┴─────────────────────────────────────────────────┘

  ▎ 注意所有黑名单和 refresh 记录都带 TTL，Redis 自动回收，不会无限膨胀——黑名单只装"已退但没过期"的 access
  ▎ token（≤15min），体积极小。

  ---
  核心流程

  流程 1：登录

  1. 校验账号密码
  2. 生成 deviceId（设备指纹，或服务端分配）
  3. ver = GET auth:uver:{userId}   // 不存在则初始化为 0
  4. 签发 accessToken {sub, jti₁, did, ver, type:access, exp:15m}
     签发 refreshToken {sub, jti₂, did, type:refresh, exp:7d}
  5. SET auth:rt:{userId}:{did} = jti₂   EX 7d   // 记录该设备的 refresh
     SADD auth:devs:{userId} did
  6. 返回 {accessToken, refreshToken}

  流程 2：业务请求校验（热路径，最高频）

  这是性能关键路径，要尽量轻：

  boolean validate(String accessToken) {
      Claims c = parseAndVerify(accessToken);        // ① 验签 + 验 exp（纯本地，不查 Redis）
      if (!"access".equals(c.get("type"))) reject();

      // ② 单设备退出：查黑名单
      if (redis.exists("auth:bl:" + c.getId())) reject();

      // ③ 全局退出/改密：比对版本号
      int curVer = userVerCache.get(c.getSub());     // 本地缓存几秒，扛住 Redis
      if (c.get("ver", int) < curVer) reject();

      return true;
  }

  ▎ 性能优化：②③ 两次 Redis 查询可以用 pipeline/MGET 合并成一次往返；版本号变更极低频，用 Caffeine
  ▎ 本地缓存几秒，短暂不一致完全可接受，能挡掉绝大部分 Redis 压力。

  流程 3：刷新（access 过期，用 refresh 换新）

  1. 验 refreshToken 签名 + exp + type==refresh
  2. 校验是否仍有效：GET auth:rt:{sub}:{did} == refreshToken.jti ?
        不等/不存在 → 拒（已退出，或这是被盗用的旧 token）
  3. 比对版本号：refresh.ver 或 curVer 校验（改密后连刷新也要挡住）
  4. 【推荐】Refresh Token Rotation：
        签发新 refreshToken（新 jti₃）
        SET auth:rt:{sub}:{did} = jti₃   // 旧 refresh 立即作废
  5. 签发新 accessToken（带当前 ver）
  6. 返回新的双 token

  流程 4：单设备退出登录

  1. SETEX auth:bl:{当前access的jti} = 1, TTL=access剩余有效期   // ② 立即作废这张 access
  2. DEL auth:rt:{userId}:{deviceId}                            // ④ 该设备无法再刷新
  3. SREM auth:devs:{userId} deviceId
  → 其他设备完全不受影响

  流程 5：退出所有设备 / 改密码 / 封号

  1. INCR auth:uver:{userId}                       // ③ 现存所有 access token 下次请求即失效（即时、全局、O(1)）
  2. 批量删 refresh：
        devs = SMEMBERS auth:devs:{userId}
        for d in devs: DEL auth:rt:{userId}:{d}     // ④ 所有设备无法再刷新
        DEL auth:devs:{userId}
  → 现存 access 立即作废 + 无法签发新的 = 全设备彻底下线

  ▎ ⚠️ 第 2 步绝不要用 KEYS auth:rt:{userId}:*（会阻塞 Redis）。靠 auth:devs:{userId} 这个 Set
  ▎ 维护设备列表来精确批量删，这就是它存在的原因。

  ---
  各场景 → 用哪个开关（速查）

  ┌─────────────────┬───────────────┬──────────┬──────────────┐
  │      场景       │   ② 黑名单    │ ③ 版本号 │ ④ 删 refresh │
  ├─────────────────┼───────────────┼──────────┼──────────────┤
  │ 单设备退出      │      ✅       │    —     │  ✅(该设备)  │
  ├─────────────────┼───────────────┼──────────┼──────────────┤
  │ 退出所有设备    │       —       │    ✅    │   ✅(全部)   │
  ├─────────────────┼───────────────┼──────────┼──────────────┤
  │ 改密码 / 封号   │       —       │    ✅    │   ✅(全部)   │
  ├─────────────────┼───────────────┼──────────┼──────────────┤
  │ access 自然过期 │ 靠 ① exp 兜底 │          │              │
  └─────────────────┴───────────────┴──────────┴──────────────┘

  可以看到三个开关各司其职、互不重叠，组合起来覆盖了所有失效场景。

  ---
  几个容易被面试官追问的关键点

  1. 为什么改密码要同时用 ③ 和 ④？
  INCR 只让现存 access 即时失效；删 refresh 让设备无法换新。只删 refresh 的话，手里那张 access 还能再活 15
  分钟——改密场景通常要求"一秒都不能多"，所以必须靠版本号补这个即时性。
  2. Refresh Token Rotation 防盗用：每次刷新都换新 refresh 并作废旧的。若攻击者偷了 refresh token
  抢先刷了一次，真实用户再用旧 token 刷新时会发现"Redis 里的 jti
  已经对不上"——可借此检测到盗用并强制该用户全局下线（触发流程 5）。
  3. deviceId 怎么来？ 客户端设备指纹、安装时生成的 UUID，或登录时服务端分配并下发。它是实现"多端独立管理"的基石。
  4. 黑名单会不会越积越多？ 不会。TTL = access 剩余有效期（≤15min），过期自动清，常驻量 = 最近 15 分钟内主动退出的 token
  数，非常小。

## JWT应该存放在哪里？

