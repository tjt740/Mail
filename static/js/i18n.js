(function () {
    'use strict';

    const STORAGE_KEY = 'mailSystemLanguage';
    const DEFAULT_LANG = 'zh';
    const SUPPORTED_LANGS = ['zh', 'zh-TW', 'en', 'vi', 'fil'];
    const LANG_LABELS = {
        zh: '简体中文',
        'zh-TW': '繁體中文',
        en: 'English',
        vi: 'Tiếng Việt',
        fil: 'Filipino'
    };
    const LANG_MARKS = {
        zh: '简',
        'zh-TW': '繁',
        en: 'EN',
        vi: 'VI',
        fil: 'FIL'
    };
    const LOCALES = { zh: 'zh-CN', 'zh-TW': 'zh-TW', en: 'en-US', vi: 'vi-VN', fil: 'fil-PH' };
    const reactManaged = document.documentElement.dataset.i18nManaged === 'react';
    const SKIP_SELECTOR = '[translate="no"], [data-i18n-ignore], [data-i18n-managed="react"], script, style, svg, code, pre';

    const dictionary = {
        en: {
            '你的云端邮局': 'YOUR MAIL, IN THE CLOUD',
            '每一封来信，': 'Something good ',
            '都值得期待。': 'is on its way.',
            '让光影流转，让消息抵达。': 'A little atmosphere for every arrival.',
            '场景切换': 'Scene selection',
            '白天': 'Day',
            '黑夜': 'Night',
            '雨夜': 'Rain',
            '语言': 'Language',
            '颜色主题': 'Color Theme',
            '暖陶橙': 'Warm Clay',
            '海洋蓝': 'Ocean Blue',
            '翡翠绿': 'Emerald Green',
            '紫罗兰': 'Violet',
            '玫瑰红': 'Rose Red',
            '邮件查看系统': 'Mail Viewer System',
            '邮件管理系统': 'Mail Management System',
            '邮件查看系统后台管理': 'Mail viewer admin console',
            '管理员登录': 'Admin Login',
            '用户名': 'Username',
            '密码': 'Password',
            '登录': 'Log In',
            '退出登录': 'Log Out',
            '欢迎': 'Welcome',
            '首页': 'Home',
            '邮箱管理': 'Mailboxes',
            '代理池': 'Proxy Pool',
            '卡密管理': 'Card Keys',
            '卡密日志': 'Card Logs',
            '收件日志': 'Mail Logs',
            '系统设置': 'System Settings',
            '展开侧边栏': 'Expand sidebar',
            '收起菜单': 'Collapse menu',
            '展开菜单': 'Expand menu',
            '展开': 'Expand',
            '收起': 'Collapse',
            '切换主题': 'Switch theme',
            '切换到明亮模式': 'Switch to light mode',
            '切换到暗黑模式': 'Switch to dark mode',
            '显示密码': 'Show password',
            '隐藏密码': 'Hide password',
            '显示/隐藏密码': 'Show/hide password',

            '添加邮箱': 'Add Mailbox',
            '批量添加邮箱': 'Batch Add Mailboxes',
            '添加服务器地址': 'Add Server Address',
            '隐藏分组': 'Hide Groups',
            '显示分组': 'Show Groups',
            '分组管理': 'Group Management',
            '所有分组': 'All Groups',
            '未分组': 'Ungrouped',
            '暂无自定义分组': 'No custom groups',
            '显示列': 'Columns',
            '复制已选': 'Copy Selected',
            '搜索': 'Search',
            '清除': 'Clear',
            '搜索邮箱地址或服务器...': 'Search mailbox or server...',
            '序号ID': 'ID',
            '序号': 'No.',
            '分组': 'Group',
            '邮箱地址': 'Email Address',
            '服务器（收/发）': 'Server (IMAP/SMTP)',
            '添加时间': 'Created At',
            '备注': 'Notes',
            '操作': 'Actions',
            '编辑': 'Edit',
            '收件': 'Receive',
            '发件': 'Send',
            '测试': 'Test',
            '删除': 'Delete',
            '保存': 'Save',
            '取消': 'Cancel',
            '确定': 'OK',
            '确认': 'Confirm',
            '关闭': 'Close',
            '新增': 'Add',
            '批量删除': 'Batch Delete',
            '全选': 'Select All',
            '导入': 'Import',
            '导出': 'Export',
            '刷新': 'Refresh',
            '加载中...': 'Loading...',
            '正在加载...': 'Loading...',
            '暂无数据': 'No data',
            '暂无记录': 'No records',
            '暂无邮箱': 'No mailboxes',
            '暂无卡密日志': 'No card logs',
            '网络错误，请稍后重试': 'Network error, please try again later',
            '复制成功': 'Copied',
            '复制失败，请手动复制': 'Copy failed, please copy manually',
            '邮箱地址已复制': 'Email address copied',
            '已复制邮箱地址': 'Email address copied',
            '复制邮箱': 'Copy Mailbox',
            '请选择要复制的邮箱': 'Please select mailboxes to copy',

            '系统概览': 'System Overview',
            '快速操作': 'Quick Actions',
            '系统信息': 'System Info',
            '页面标题设置': 'Page Title Settings',
            '系统标题设置': 'System Title Settings',
            '管理员账号': 'Admin Account',
            '管理员列表': 'Admin List',
            '新增管理员': 'Add Admin',
            '重置密码': 'Reset Password',
            '当前管理员': 'Current Admin',
            '邮箱范围权限': 'Mailbox Access',
            '管理员邮箱可见范围': 'Admin Mailbox Access',
            '受限管理员': 'Restricted Admin',
            '目标管理员': 'Target Admin',
            '搜索邮箱': 'Search Mailboxes',
            '搜索邮箱地址、操作人或备注...': 'Search email, operator, or notes...',
            '正在加载邮箱范围...': 'Loading mailbox access...',
            '保存可见范围': 'Save Access',
            '没有匹配的邮箱': 'No matching mailboxes',
            '本人添加 · 始终可见': 'Added by this admin · Always visible',
            '历史数据': 'Legacy data',
            '受限管理员默认只能看到自己添加的邮箱。这里勾选的邮箱会作为额外授权；未勾选的其他管理员邮箱及其分组不会出现在邮箱管理、搜索、卡密绑定和收件日志中。': 'Restricted admins see only mailboxes they added by default. Checked mailboxes are additional grants; unchecked mailboxes from other admins and their groups are hidden from mailbox management, search, card binding, and mail logs.',
            '可为任意管理员单独启用邮箱范围限制。启用后，该管理员只能看到自己添加的邮箱，以及这里授权的邮箱分组和单个邮箱；分组中新加入的邮箱会自动继承权限。': 'Mailbox restrictions can be enabled separately for any admin. Once enabled, that admin sees only their own mailboxes plus granted groups and individual mailboxes. New mailboxes added to a granted group inherit access automatically.',
            '限制该管理员的邮箱范围': 'Restrict this admin’s mailbox access',
            '关闭时可查看全部邮箱；开启后按下方授权范围显示。': 'When off, all mailboxes are visible. When on, visibility follows the grants below.',
            '已启用限制': 'Restriction enabled',
            '未启用限制': 'Not restricted',
            '按邮箱分组授权': 'Grant by Mailbox Group',
            '授权整个分组，后续加入的邮箱自动可见': 'Grant the whole group; future mailboxes become visible automatically',
            '按单个邮箱授权': 'Grant Individual Mailboxes',
            '可与分组权限叠加': 'Can be combined with group access',
            '正在加载邮箱分组...': 'Loading mailbox groups...',
            '暂无可授权分组': 'No mailbox groups available',
            '当前未限制，可查看全部邮箱': 'Not restricted; all mailboxes are visible',
            '请选择受限管理员': 'Select a restricted admin',
            '获取邮箱范围失败': 'Failed to load mailbox access',
            '保存邮箱范围失败': 'Failed to save mailbox access',
            '邮箱可见范围已保存': 'Mailbox access saved',
            '管理员万能秘钥': 'Admin Master Key',
            '万能秘钥': 'Master Key',
            '保存设置': 'Save Settings',

            '代理池管理': 'Proxy Pool',
            'HTTP代理': 'HTTP Proxy',
            'SOCKS5代理': 'SOCKS5 Proxy',
            '添加代理': 'Add Proxy',
            '批量添加代理': 'Batch Add Proxies',
            '代理地址': 'Proxy Address',
            '端口': 'Port',
            '状态': 'Status',
            '启用': 'Enable',
            '禁用': 'Disable',

            '卡密': 'Card Key',
            '生成卡密': 'Generate Key',
            '批量生成': 'Batch Generate',
            '使用次数': 'Uses',
            '剩余次数': 'Remaining',
            '过期时间': 'Expires At',
            '绑定邮箱': 'Bound Email',
            '回收站': 'Recycle Bin',
            '清空日志': 'Clear Logs',
            '保存定期清理': 'Save Cleanup',
            '保留天数(0关闭)': 'Retention days (0 off)',
            '卡密使用日志': 'Card Usage Logs',
            '邮件标题': 'Mail Subject',
            '使用者IP': 'User IP',
            '使用时间（北京时间）': 'Used At (Beijing Time)',
            '卡密绑定邮箱': 'Bound Email',

            '邮件查看': 'Mail Viewer',
            '输入后台邮箱地址，即刻查看最新邮件': 'Enter a configured mailbox to view the latest messages',
            '卡密 / 管理员万能秘钥': 'Card Key / Admin Master Key',
            '请输入卡密或管理员万能秘钥': 'Enter a card key or admin master key',
            '设置后的万能秘钥可免卡密取件': 'A configured master key can fetch mail without a card key',
            '邮箱查询': 'Mailbox Query',
            '查询邮箱': 'Queried Mailboxes',
            '请输入邮箱地址 (例: user@example.com)': 'Enter email address (e.g. user@example.com)',
            '请输入邮局后台已添加的邮箱地址，支持多个自动识别：user@example.com\ntest@example.com, demo@example.com': 'Enter mailbox addresses already added by the administrator. Multiple addresses are auto-detected:\nuser@example.com\ntest@example.com, demo@example.com',
            '请输入邮箱地址，支持多个邮箱自动识别：user@example.com\ntest@example.com, demo@example.com': 'Enter email addresses. Multiple addresses are auto-detected:\nuser@example.com\ntest@example.com, demo@example.com',
            '每个邮箱收取': 'Per mailbox',
            '支持换行、逗号、空格、竖线等格式，会自动识别邮箱地址；默认每个邮箱查询 10 封。': 'Supports line breaks, commas, spaces, pipes, and more. Email addresses are detected automatically. Default is 10 mails per mailbox.',
            '收取封数': 'Mail count',
            '获取邮件': 'Fetch Mail',
            '获取中...': 'Fetching...',
            '邮箱文件夹': 'Mail Folders',
            '展开邮箱文件夹': 'Expand Mail Folders',
            '折叠邮箱文件夹': 'Collapse Mail Folders',
            '收件箱': 'Inbox',
            '垃圾箱': 'Trash',
            '正在获取邮件，请稍候...': 'Fetching mail, please wait...',
            '邮箱': 'Mailbox',
            '标题': 'Subject',
            '验证码': 'Code',
            '发件人': 'From',
            '收件人': 'To',
            '时间': 'Time',
            '暂无邮件': 'No mail',
            '返回邮件列表': 'Back to Mail List',
            '发件人:': 'From:',
            '收件人:': 'To:',
            '时间:': 'Time:',
            '图片内容': 'Images',
            '附件': 'Attachments',
            '下载': 'Download',
            '请输入邮箱地址': 'Please enter an email address',
            '单次最多支持 50 个邮箱，请分批查询': 'Up to 50 mailboxes are supported per query. Please split into batches.',
            '已检测到管理员登录状态，免卡密访问': 'Admin login detected. Card key is not required.',
            '您尚未登录管理员账户，请使用卡密或万能秘钥访问': 'You are not logged in as admin. Use a card key or master key to access mail.',
            '未获取到邮件': 'No mail was fetched',
            '请求失败': 'Request failed',
            '请输入有效的邮箱地址': 'Please enter a valid email address',
            '邮箱中暂无邮件': 'No mail in this mailbox',
            '获取邮件失败': 'Failed to fetch mail',
            '网络请求失败，请检查网络连接': 'Network request failed, please check your connection',
            '邮件获取成功': 'Mail fetched successfully',
            '附件下载已开始': 'Attachment download started',
            '附件下载失败': 'Attachment download failed',
            '未知': 'Unknown',
            '无主题': 'No subject',
            '（无主题）': '(No subject)',
            '(无主题)': '(No subject)',
            '(邮件内容为空)': '(Mail body is empty)',
            '（无正文）': '(No body)',

            '批量复制': 'Batch Copy',
            '批量分组': 'Batch Group',
            '管理员：': 'Admin:',
            '当前分组：': 'Current Group:',
            '邮箱：': 'Mailboxes:',
            '已选：': 'Selected:',
            '已选': 'Selected',
            '个邮箱': 'mailboxes',
            '取消选择': 'Clear Selection',
            '选择': 'Select',
            '上级分组': 'Parent Group',
            '分组名称': 'Group Name',
            '输入分组名称': 'Enter group name',
            '添加分组': 'Add Group',
            '添加下级分组': 'Add Child Group',
            '编辑分组': 'Edit Group',
            '已选择邮箱': 'Selected Mailboxes',
            '目标分组': 'Target Group',
            '应用分组': 'Apply Group',
            '发送邮件': 'Send Mail',
            '昵称': 'Nickname',
            '收件人看到的发件人昵称（可选）': 'Sender nickname shown to recipients (optional)',
            '主题': 'Subject',
            '正文': 'Body',
            '邮件主题': 'Mail subject',
            '邮件正文': 'Mail body',
            '当前邮箱': 'Current Mailbox',
            '收取': 'Fetch',
            '封': 'messages',
            '收取邮件': 'Fetch Mail',
            '收件失败': 'Fetch Failed',
            '返回列表': 'Back to List',
            '图片': 'Images',
            '邮箱账号': 'Mailbox Account',
            '邮箱密码': 'Mailbox Password',
            '邮箱密码或授权码': 'Mailbox password or app password',
            '选择服务器': 'Select Server',
            '选择已有服务器或手动输入': 'Select an existing server or enter manually',
            '收件服务器地址': 'Incoming Server',
            '发件服务器地址': 'Outgoing Server',
            '收件协议': 'Incoming Protocol',
            '发件协议': 'Outgoing Protocol',
            '收件端口': 'Incoming Port',
            '发件端口': 'Outgoing Port',
            '收件启用SSL': 'Incoming SSL',
            '发件启用SSL': 'Outgoing SSL',
            '输入备注信息': 'Enter notes',
            '输入操作人': 'Enter operator',
            '自动识别邮箱内容': 'Auto-detect Mailbox Content',
            '输入新分组名，回车添加': 'Enter a new group name, press Enter to add',
            '可直接新增分组，添加后会自动选中。': 'You can add a group here; it will be selected automatically.',
            '批量添加': 'Batch Add',
            '编辑备注': 'Edit Notes',
            '备注内容': 'Note Content',
            '服务器地址管理': 'Server Address Management',
            '服务器名称': 'Server Name',
            '添加服务器': 'Add Server',
            '更新服务器': 'Update Server',
            '已添加的服务器': 'Saved Servers',
            '批量删除选中': 'Delete Selected',
            '暂无服务器配置': 'No server configurations',
            '收/发信息': 'Incoming/Outgoing',
            '检测状态': 'Check Status',
            '添加人': 'Added By',
            '操作人': 'Operator',
            '最后修改时间': 'Last Updated',
            '未检测': 'Not Checked',
            '邮箱正常': 'Mailbox OK',
            '邮箱异常': 'Mailbox Error',
            '历史数据': 'Legacy Data',
            '未指定': 'Unassigned',
            '全部添加人': 'All Added By',
            '全部操作人': 'All Operators',
            '按检测状态筛选': 'Filter by check status',
            '按添加人筛选': 'Filter by added by',
            '按操作人筛选': 'Filter by operator',
            '尚未检测': 'Not checked yet',
            '收：': 'In:',
            '发：': 'Out:',
            '更多': 'More',
            '点击复制邮箱': 'Click to copy mailbox',
            '暂无邮箱账号': 'No mailbox accounts',
            '每页': 'Per page',
            '上一页': 'Previous',
            '下一页': 'Next',
            '加载邮箱列表失败': 'Failed to load mailbox list',
            '请填写分组名称': 'Please enter a group name',
            '分组添加成功': 'Group added',
            '分组添加失败': 'Failed to add group',
            '分组更新成功': 'Group updated',
            '分组更新失败': 'Failed to update group',
            '分组删除成功': 'Group deleted',
            '分组删除失败': 'Failed to delete group',
            '分组分配失败': 'Failed to assign group',
            '确定要删除该分组及其子分组吗？': 'Delete this group and its child groups?',
            '登录状态已失效，请刷新页面后重新登录': 'Login expired. Refresh and sign in again.',
            '测试中...': 'Testing...',
            '测试失败：Microsoft OAuth 拒绝该账号，账号处于 service abuse mode': 'Test failed: Microsoft OAuth rejected this account because it is in service abuse mode',
            '测试失败：OAuth 令牌获取失败': 'Test failed: OAuth token request failed',
            '测试失败：邮箱认证失败，请检查密码、授权码或 OAuth 数据': 'Test failed: mailbox authentication failed. Check password, app password, or OAuth data',
            'Microsoft OAuth 拒绝该账号登录，账号处于 service abuse mode': 'Microsoft OAuth rejected this account because it is in service abuse mode',
            'OAuth 令牌获取失败': 'OAuth token request failed',
            '邮箱认证失败': 'Mailbox authentication failed',
            'SSL 连接失败': 'SSL connection failed',
            '未找到邮箱信息': 'Mailbox not found',
            '所有邮件已存在，未发现新邮件': 'All mail already exists. No new mail found.',
            '邮箱中暂无新邮件': 'No new mail in this mailbox',
            '收件失败，详情已显示在弹窗内': 'Fetch failed. Details are shown in the modal.',
            '网络错误，详情已显示在弹窗内': 'Network error. Details are shown in the modal.',
            '请填写完整的邮箱信息后再测试': 'Complete mailbox information before testing',
            '邮箱连接测试成功': 'Mailbox connection test passed',
            '测试请求失败，请检查服务是否正常运行': 'Test request failed. Check whether the service is running.',
            '请填写收件人地址': 'Please enter recipient address',
            '发送成功': 'Sent successfully',
            '发送失败': 'Send failed',
            '确定要删除这个邮箱账号吗？': 'Delete this mailbox account?',
            '邮箱删除成功': 'Mailbox deleted',
            '删除失败': 'Delete failed',
            '请填写完整的收/发件服务器信息': 'Complete incoming and outgoing server information',
            '保存成功': 'Saved',
            '保存失败': 'Save failed',
            '请填写所有必需字段': 'Please fill in all required fields',
            '批量添加成功': 'Batch add succeeded',
            '批量添加失败': 'Batch add failed',
            '邮箱地址为空': 'Mailbox address is empty',
            '选中的邮箱不存在': 'Selected mailboxes do not exist',
            '请选择要分组的邮箱': 'Select mailboxes to group',
            '请选择要删除的邮箱': 'Select mailboxes to delete',
            '批量删除成功': 'Batch delete succeeded',
            '批量删除失败': 'Batch delete failed',
            '请填写完整的服务器信息': 'Complete server information',
            '服务器保存成功': 'Server saved',
            '服务器保存失败': 'Failed to save server',
            '确定要删除这个服务器配置吗？': 'Delete this server configuration?',
            '服务器删除成功': 'Server deleted',
            '请选择要删除的服务器': 'Select servers to delete',
            '获取邮箱信息失败': 'Failed to get mailbox information',
            '邮箱ID缺失': 'Mailbox ID is missing',
            '备注保存成功': 'Notes saved',

            '邮件收件日志': 'Mail Receiving Logs',
            '日志总数': 'Total Logs',
            '成功收取': 'Successful Fetches',
            '失败记录': 'Failed Records',
            '轮询间隔': 'Polling Interval',
            '关键词：邮箱、主题、发件人、正文': 'Keywords: mailbox, subject, sender, body',
            '全部状态': 'All Statuses',
            '已处理': 'Processed',
            '全部管理员': 'All Admins',
            '查询': 'Search',
            '清空': 'Clear',
            '立即查询': 'Query Now',
            '批量筛选': 'Batch Filter',
            '批量邮箱筛选：每行或逗号分隔多个邮箱': 'Batch mailbox filter: one per line or comma-separated',
            '批量主题筛选：每行或逗号分隔多个关键词': 'Batch subject filter: one per line or comma-separated',
            '批量发件人筛选：每行或逗号分隔多个发件人': 'Batch sender filter: one per line or comma-separated',
            '最近开始': 'Last Started',
            '最近结束': 'Last Finished',
            '结果': 'Result',
            '收件日志详情': 'Mail Log Details',
            '自动轮询': 'Auto Poll',
            '手动轮询': 'Manual Poll',
            '后台取件': 'Admin Fetch',
            '卡密接口': 'Card API',
            '卡密预览': 'Card Preview',
            '手动': 'Manual',
            '验证码': 'Code',
            '管理员': 'Admin',
            '主题 / 摘要': 'Subject / Summary',
            '收件时间': 'Received At',
            '详情': 'Details',
            '最后查询': 'Last Query',
            '暂无收件日志': 'No mail logs',
            '日志ID': 'Log ID',
            '收件邮箱': 'Mailbox',
            '来源': 'Source',
            '记录': 'Recorded',
            '邮件正文': 'Mail Body',
            '处理建议': 'Advice',
            '错误详情': 'Error Details',
            '检查邮箱密码/授权码是否正确，确认邮箱已开启 IMAP，并确认账号没有触发安全拦截。': 'Check the mailbox password/app password, confirm IMAP is enabled, and make sure the account is not blocked by a security check.',
            '检查收件服务器端口和 SSL 开关是否匹配；常见 IMAP SSL 使用 993，STARTTLS 或非 SSL 配置不要使用隐式 SSL。': 'Check that the incoming server port matches the SSL setting. IMAP SSL commonly uses 993; STARTTLS or non-SSL should not use implicit SSL.',
            '检查服务器地址、端口、网络连通性和代理配置。': 'Check server address, port, network connectivity, and proxy settings.',
            '检查服务器域名是否填写正确，或当前网络是否能解析该域名。': 'Check whether the server domain is correct and resolvable from the current network.',
            '根据完整错误检查邮箱账号、授权码、服务器地址、端口、SSL 和代理配置。': 'Check mailbox account, app password, server address, port, SSL, and proxy settings based on the full error.',
            '这条是收取失败记录，没有实际邮件正文。请查看下方错误详情。': 'This is a failed fetch record and has no actual mail body. See the error details below.',
            '这条记录没有保存正文。重新收取或轮询成功后，这里会显示实际邮件内容。': 'This record has no saved body. After a successful fetch or poll, the actual mail content will appear here.',
            '登录状态已失效，请重新登录': 'Login expired. Please sign in again.',
            '获取收件日志失败': 'Failed to load mail logs',
            '启动中...': 'Starting...',
            '已开始轮询': 'Polling started',
            '轮询启动失败': 'Failed to start polling',

            'API取件页面': 'API Mail Fetch Page',
            '此卡密不存在': 'This card key does not exist',
            '请检查卡密是否正确，或联系管理员获取有效卡密': 'Please check the card key or contact the administrator',
            '复制': 'Copy'
        },
        vi: {
            '你的云端邮局': 'HỘP THƯ TRÊN MÂY',
            '每一封来信，': 'Mỗi thư đến ',
            '都值得期待。': 'đều đáng mong chờ.',
            '让光影流转，让消息抵达。': 'Ánh sáng chuyển mình, tin nhắn đến nơi.',
            '场景切换': 'Chọn khung cảnh',
            '白天': 'Ban ngày',
            '黑夜': 'Ban đêm',
            '雨夜': 'Đêm mưa',
            '语言': 'Ngôn ngữ',
            '颜色主题': 'Chủ đề màu sắc',
            '暖陶橙': 'Cam đất ấm',
            '海洋蓝': 'Xanh đại dương',
            '翡翠绿': 'Xanh ngọc lục bảo',
            '紫罗兰': 'Tím violet',
            '玫瑰红': 'Đỏ hoa hồng',
            '邮件查看系统': 'Hệ thống xem thư',
            '邮件管理系统': 'Hệ thống quản lý thư',
            '邮件查看系统后台管理': 'Trang quản trị hệ thống xem thư',
            '管理员登录': 'Đăng nhập quản trị',
            '用户名': 'Tên đăng nhập',
            '密码': 'Mật khẩu',
            '登录': 'Đăng nhập',
            '退出登录': 'Đăng xuất',
            '欢迎': 'Xin chào',
            '首页': 'Trang chủ',
            '邮箱管理': 'Quản lý hộp thư',
            '代理池': 'Nhóm proxy',
            '卡密管理': 'Quản lý mã',
            '卡密日志': 'Nhật ký mã',
            '收件日志': 'Nhật ký nhận thư',
            '系统设置': 'Cài đặt hệ thống',
            '展开侧边栏': 'Mở thanh bên',
            '收起菜单': 'Thu gọn menu',
            '展开菜单': 'Mở menu',
            '展开': 'Mở rộng',
            '收起': 'Thu gọn',
            '切换主题': 'Đổi giao diện',
            '切换到明亮模式': 'Chuyển sang giao diện sáng',
            '切换到暗黑模式': 'Chuyển sang giao diện tối',
            '显示密码': 'Hiện mật khẩu',
            '隐藏密码': 'Ẩn mật khẩu',
            '显示/隐藏密码': 'Hiện/ẩn mật khẩu',

            '添加邮箱': 'Thêm hộp thư',
            '批量添加邮箱': 'Thêm hộp thư hàng loạt',
            '添加服务器地址': 'Thêm địa chỉ máy chủ',
            '隐藏分组': 'Ẩn nhóm',
            '显示分组': 'Hiện nhóm',
            '分组管理': 'Quản lý nhóm',
            '所有分组': 'Tất cả nhóm',
            '未分组': 'Chưa phân nhóm',
            '暂无自定义分组': 'Chưa có nhóm tùy chỉnh',
            '显示列': 'Cột hiển thị',
            '复制已选': 'Sao chép đã chọn',
            '搜索': 'Tìm kiếm',
            '清除': 'Xóa lọc',
            '搜索邮箱地址或服务器...': 'Tìm hộp thư hoặc máy chủ...',
            '序号ID': 'ID',
            '序号': 'STT',
            '分组': 'Nhóm',
            '邮箱地址': 'Địa chỉ email',
            '服务器（收/发）': 'Máy chủ (nhận/gửi)',
            '添加时间': 'Thời gian thêm',
            '备注': 'Ghi chú',
            '操作': 'Thao tác',
            '编辑': 'Sửa',
            '收件': 'Nhận',
            '发件': 'Gửi',
            '测试': 'Kiểm tra',
            '删除': 'Xóa',
            '保存': 'Lưu',
            '取消': 'Hủy',
            '确定': 'OK',
            '确认': 'Xác nhận',
            '关闭': 'Đóng',
            '新增': 'Thêm',
            '批量删除': 'Xóa hàng loạt',
            '全选': 'Chọn tất cả',
            '导入': 'Nhập',
            '导出': 'Xuất',
            '刷新': 'Làm mới',
            '加载中...': 'Đang tải...',
            '正在加载...': 'Đang tải...',
            '暂无数据': 'Không có dữ liệu',
            '暂无记录': 'Không có bản ghi',
            '暂无邮箱': 'Không có hộp thư',
            '暂无卡密日志': 'Chưa có nhật ký mã',
            '网络错误，请稍后重试': 'Lỗi mạng, vui lòng thử lại sau',
            '复制成功': 'Đã sao chép',
            '复制失败，请手动复制': 'Sao chép thất bại, vui lòng sao chép thủ công',
            '邮箱地址已复制': 'Đã sao chép địa chỉ email',
            '已复制邮箱地址': 'Đã sao chép địa chỉ email',
            '复制邮箱': 'Sao chép hộp thư',
            '请选择要复制的邮箱': 'Vui lòng chọn hộp thư cần sao chép',

            '系统概览': 'Tổng quan hệ thống',
            '快速操作': 'Thao tác nhanh',
            '系统信息': 'Thông tin hệ thống',
            '页面标题设置': 'Cài đặt tiêu đề trang',
            '系统标题设置': 'Cài đặt tiêu đề hệ thống',
            '管理员账号': 'Tài khoản quản trị',
            '管理员列表': 'Danh sách quản trị',
            '新增管理员': 'Thêm quản trị',
            '重置密码': 'Đặt lại mật khẩu',
            '当前管理员': 'Quản trị hiện tại',
            '邮箱范围权限': 'Quyền truy cập hộp thư',
            '管理员邮箱可见范围': 'Phạm vi hộp thư của quản trị viên',
            '受限管理员': 'Quản trị viên bị giới hạn',
            '目标管理员': 'Quản trị viên mục tiêu',
            '搜索邮箱': 'Tìm hộp thư',
            '搜索邮箱地址、操作人或备注...': 'Tìm email, người thao tác hoặc ghi chú...',
            '正在加载邮箱范围...': 'Đang tải phạm vi hộp thư...',
            '保存可见范围': 'Lưu phạm vi hiển thị',
            '没有匹配的邮箱': 'Không có hộp thư phù hợp',
            '本人添加 · 始终可见': 'Do quản trị viên này thêm · Luôn hiển thị',
            '历史数据': 'Dữ liệu cũ',
            '受限管理员默认只能看到自己添加的邮箱。这里勾选的邮箱会作为额外授权；未勾选的其他管理员邮箱及其分组不会出现在邮箱管理、搜索、卡密绑定和收件日志中。': 'Quản trị viên bị giới hạn mặc định chỉ thấy hộp thư do mình thêm. Các hộp thư được chọn là quyền bổ sung; hộp thư của quản trị viên khác và nhóm của chúng sẽ bị ẩn khỏi quản lý hộp thư, tìm kiếm, liên kết mã và nhật ký thư.',
            '可为任意管理员单独启用邮箱范围限制。启用后，该管理员只能看到自己添加的邮箱，以及这里授权的邮箱分组和单个邮箱；分组中新加入的邮箱会自动继承权限。': 'Có thể bật giới hạn hộp thư riêng cho từng quản trị viên. Khi bật, họ chỉ thấy hộp thư của mình cùng các nhóm và hộp thư riêng lẻ được cấp quyền. Hộp thư mới thêm vào nhóm được cấp quyền sẽ tự động hiển thị.',
            '限制该管理员的邮箱范围': 'Giới hạn phạm vi hộp thư của quản trị viên này',
            '关闭时可查看全部邮箱；开启后按下方授权范围显示。': 'Khi tắt sẽ thấy tất cả hộp thư; khi bật sẽ hiển thị theo quyền bên dưới.',
            '已启用限制': 'Đã bật giới hạn',
            '未启用限制': 'Chưa giới hạn',
            '按邮箱分组授权': 'Cấp quyền theo nhóm hộp thư',
            '授权整个分组，后续加入的邮箱自动可见': 'Cấp quyền cả nhóm; hộp thư thêm sau sẽ tự động hiển thị',
            '按单个邮箱授权': 'Cấp quyền từng hộp thư',
            '可与分组权限叠加': 'Có thể kết hợp với quyền theo nhóm',
            '正在加载邮箱分组...': 'Đang tải nhóm hộp thư...',
            '暂无可授权分组': 'Không có nhóm hộp thư để cấp quyền',
            '当前未限制，可查看全部邮箱': 'Chưa giới hạn; có thể xem tất cả hộp thư',
            '请选择受限管理员': 'Chọn quản trị viên bị giới hạn',
            '获取邮箱范围失败': 'Không thể tải phạm vi hộp thư',
            '保存邮箱范围失败': 'Không thể lưu phạm vi hộp thư',
            '邮箱可见范围已保存': 'Đã lưu phạm vi hộp thư',
            '管理员万能秘钥': 'Khóa tổng quản trị',
            '万能秘钥': 'Khóa tổng',
            '保存设置': 'Lưu cài đặt',

            '代理池管理': 'Quản lý proxy',
            'HTTP代理': 'Proxy HTTP',
            'SOCKS5代理': 'Proxy SOCKS5',
            '添加代理': 'Thêm proxy',
            '批量添加代理': 'Thêm proxy hàng loạt',
            '代理地址': 'Địa chỉ proxy',
            '端口': 'Cổng',
            '状态': 'Trạng thái',
            '启用': 'Bật',
            '禁用': 'Tắt',

            '卡密': 'Mã',
            '生成卡密': 'Tạo mã',
            '批量生成': 'Tạo hàng loạt',
            '使用次数': 'Số lần dùng',
            '剩余次数': 'Còn lại',
            '过期时间': 'Hết hạn',
            '绑定邮箱': 'Email đã liên kết',
            '回收站': 'Thùng rác',
            '清空日志': 'Xóa nhật ký',
            '保存定期清理': 'Lưu dọn dẹp định kỳ',
            '保留天数(0关闭)': 'Số ngày lưu (0 tắt)',
            '卡密使用日志': 'Nhật ký sử dụng mã',
            '邮件标题': 'Tiêu đề thư',
            '使用者IP': 'IP người dùng',
            '使用时间（北京时间）': 'Thời gian dùng (Bắc Kinh)',
            '卡密绑定邮箱': 'Email liên kết mã',

            '邮件查看': 'Xem thư',
            '输入后台邮箱地址，即刻查看最新邮件': 'Nhập hộp thư đã cấu hình để xem thư mới nhất',
            '卡密 / 管理员万能秘钥': 'Mã / Khóa tổng quản trị',
            '请输入卡密或管理员万能秘钥': 'Nhập mã hoặc khóa tổng quản trị',
            '设置后的万能秘钥可免卡密取件': 'Khóa tổng đã đặt có thể lấy thư không cần mã',
            '邮箱查询': 'Truy vấn hộp thư',
            '查询邮箱': 'Hộp thư đã tra cứu',
            '请输入邮箱地址 (例: user@example.com)': 'Nhập địa chỉ email (ví dụ: user@example.com)',
            '请输入邮局后台已添加的邮箱地址，支持多个自动识别：user@example.com\ntest@example.com, demo@example.com': 'Nhập địa chỉ hộp thư đã được quản trị viên thêm. Tự nhận diện nhiều địa chỉ:\nuser@example.com\ntest@example.com, demo@example.com',
            '请输入邮箱地址，支持多个邮箱自动识别：user@example.com\ntest@example.com, demo@example.com': 'Nhập địa chỉ email. Có thể tự nhận diện nhiều email:\nuser@example.com\ntest@example.com, demo@example.com',
            '每个邮箱收取': 'Mỗi hộp thư',
            '支持换行、逗号、空格、竖线等格式，会自动识别邮箱地址；默认每个邮箱查询 10 封。': 'Hỗ trợ xuống dòng, dấu phẩy, khoảng trắng, dấu gạch đứng và nhiều định dạng khác. Mặc định truy vấn 10 thư cho mỗi hộp thư.',
            '收取封数': 'Số thư nhận',
            '获取邮件': 'Lấy thư',
            '获取中...': 'Đang lấy...',
            '邮箱文件夹': 'Thư mục hộp thư',
            '展开邮箱文件夹': 'Mở thư mục hộp thư',
            '折叠邮箱文件夹': 'Thu gọn thư mục hộp thư',
            '收件箱': 'Hộp thư đến',
            '垃圾箱': 'Thùng rác',
            '正在获取邮件，请稍候...': 'Đang lấy thư, vui lòng chờ...',
            '邮箱': 'Hộp thư',
            '标题': 'Tiêu đề',
            '验证码': 'Mã xác minh',
            '发件人': 'Người gửi',
            '收件人': 'Người nhận',
            '时间': 'Thời gian',
            '暂无邮件': 'Không có thư',
            '返回邮件列表': 'Quay lại danh sách thư',
            '发件人:': 'Người gửi:',
            '收件人:': 'Người nhận:',
            '时间:': 'Thời gian:',
            '图片内容': 'Hình ảnh',
            '附件': 'Tệp đính kèm',
            '下载': 'Tải xuống',
            '请输入邮箱地址': 'Vui lòng nhập địa chỉ email',
            '单次最多支持 50 个邮箱，请分批查询': 'Mỗi lần hỗ trợ tối đa 50 hộp thư. Vui lòng chia thành nhiều lượt.',
            '已检测到管理员登录状态，免卡密访问': 'Đã phát hiện đăng nhập quản trị. Không cần mã.',
            '您尚未登录管理员账户，请使用卡密或万能秘钥访问': 'Bạn chưa đăng nhập quản trị. Hãy dùng mã hoặc khóa tổng để truy cập thư.',
            '未获取到邮件': 'Không lấy được thư',
            '请求失败': 'Yêu cầu thất bại',
            '请输入有效的邮箱地址': 'Vui lòng nhập địa chỉ email hợp lệ',
            '邮箱中暂无邮件': 'Hộp thư này chưa có thư',
            '获取邮件失败': 'Lấy thư thất bại',
            '网络请求失败，请检查网络连接': 'Yêu cầu mạng thất bại, vui lòng kiểm tra kết nối',
            '邮件获取成功': 'Lấy thư thành công',
            '附件下载已开始': 'Đã bắt đầu tải tệp đính kèm',
            '附件下载失败': 'Tải tệp đính kèm thất bại',
            '未知': 'Không rõ',
            '无主题': 'Không có tiêu đề',
            '（无主题）': '(Không có tiêu đề)',
            '(无主题)': '(Không có tiêu đề)',
            '(邮件内容为空)': '(Nội dung thư trống)',
            '（无正文）': '(Không có nội dung)',

            '批量复制': 'Sao chép hàng loạt',
            '批量分组': 'Phân nhóm hàng loạt',
            '管理员：': 'Quản trị:',
            '当前分组：': 'Nhóm hiện tại:',
            '邮箱：': 'Hộp thư:',
            '已选：': 'Đã chọn:',
            '已选': 'Đã chọn',
            '个邮箱': 'hộp thư',
            '取消选择': 'Bỏ chọn',
            '选择': 'Chọn',
            '上级分组': 'Nhóm cha',
            '分组名称': 'Tên nhóm',
            '输入分组名称': 'Nhập tên nhóm',
            '添加分组': 'Thêm nhóm',
            '添加下级分组': 'Thêm nhóm con',
            '编辑分组': 'Sửa nhóm',
            '已选择邮箱': 'Hộp thư đã chọn',
            '目标分组': 'Nhóm đích',
            '应用分组': 'Áp dụng nhóm',
            '发送邮件': 'Gửi thư',
            '昵称': 'Biệt danh',
            '收件人看到的发件人昵称（可选）': 'Biệt danh người gửi hiển thị cho người nhận (tùy chọn)',
            '主题': 'Tiêu đề',
            '正文': 'Nội dung',
            '邮件主题': 'Tiêu đề thư',
            '邮件正文': 'Nội dung thư',
            '当前邮箱': 'Hộp thư hiện tại',
            '收取': 'Lấy',
            '封': 'thư',
            '收取邮件': 'Lấy thư',
            '收件失败': 'Lấy thư thất bại',
            '返回列表': 'Quay lại danh sách',
            '图片': 'Hình ảnh',
            '邮箱账号': 'Tài khoản hộp thư',
            '邮箱密码': 'Mật khẩu hộp thư',
            '邮箱密码或授权码': 'Mật khẩu hộp thư hoặc mã ứng dụng',
            '选择服务器': 'Chọn máy chủ',
            '选择已有服务器或手动输入': 'Chọn máy chủ đã có hoặc nhập thủ công',
            '收件服务器地址': 'Máy chủ nhận',
            '发件服务器地址': 'Máy chủ gửi',
            '收件协议': 'Giao thức nhận',
            '发件协议': 'Giao thức gửi',
            '收件端口': 'Cổng nhận',
            '发件端口': 'Cổng gửi',
            '收件启用SSL': 'Bật SSL nhận',
            '发件启用SSL': 'Bật SSL gửi',
            '输入备注信息': 'Nhập ghi chú',
            '输入操作人': 'Nhập người thao tác',
            '自动识别邮箱内容': 'Tự nhận diện nội dung hộp thư',
            '输入新分组名，回车添加': 'Nhập tên nhóm mới, nhấn Enter để thêm',
            '可直接新增分组，添加后会自动选中。': 'Có thể thêm nhóm tại đây; sau khi thêm sẽ tự chọn.',
            '批量添加': 'Thêm hàng loạt',
            '编辑备注': 'Sửa ghi chú',
            '备注内容': 'Nội dung ghi chú',
            '服务器地址管理': 'Quản lý địa chỉ máy chủ',
            '服务器名称': 'Tên máy chủ',
            '添加服务器': 'Thêm máy chủ',
            '更新服务器': 'Cập nhật máy chủ',
            '已添加的服务器': 'Máy chủ đã lưu',
            '批量删除选中': 'Xóa mục đã chọn',
            '暂无服务器配置': 'Chưa có cấu hình máy chủ',
            '收/发信息': 'Thông tin nhận/gửi',
            '检测状态': 'Trạng thái kiểm tra',
            '添加人': 'Người thêm',
            '操作人': 'Người thao tác',
            '最后修改时间': 'Sửa lần cuối',
            '未检测': 'Chưa kiểm tra',
            '邮箱正常': 'Hộp thư bình thường',
            '邮箱异常': 'Hộp thư lỗi',
            '历史数据': 'Dữ liệu cũ',
            '未指定': 'Chưa chỉ định',
            '全部添加人': 'Tất cả người thêm',
            '全部操作人': 'Tất cả người thao tác',
            '按检测状态筛选': 'Lọc theo trạng thái kiểm tra',
            '按添加人筛选': 'Lọc theo người thêm',
            '按操作人筛选': 'Lọc theo người thao tác',
            '尚未检测': 'Chưa kiểm tra',
            '收：': 'Nhận:',
            '发：': 'Gửi:',
            '更多': 'Thêm',
            '点击复制邮箱': 'Bấm để sao chép hộp thư',
            '暂无邮箱账号': 'Chưa có tài khoản hộp thư',
            '每页': 'Mỗi trang',
            '上一页': 'Trang trước',
            '下一页': 'Trang sau',
            '加载邮箱列表失败': 'Tải danh sách hộp thư thất bại',
            '请填写分组名称': 'Vui lòng nhập tên nhóm',
            '分组添加成功': 'Đã thêm nhóm',
            '分组添加失败': 'Thêm nhóm thất bại',
            '分组更新成功': 'Đã cập nhật nhóm',
            '分组更新失败': 'Cập nhật nhóm thất bại',
            '分组删除成功': 'Đã xóa nhóm',
            '分组删除失败': 'Xóa nhóm thất bại',
            '分组分配失败': 'Gán nhóm thất bại',
            '确定要删除该分组及其子分组吗？': 'Xóa nhóm này và các nhóm con?',
            '登录状态已失效，请刷新页面后重新登录': 'Phiên đăng nhập hết hạn. Vui lòng tải lại và đăng nhập lại.',
            '测试中...': 'Đang kiểm tra...',
            '测试失败：Microsoft OAuth 拒绝该账号，账号处于 service abuse mode': 'Kiểm tra thất bại: Microsoft OAuth từ chối tài khoản vì đang ở chế độ service abuse',
            '测试失败：OAuth 令牌获取失败': 'Kiểm tra thất bại: lấy token OAuth thất bại',
            '测试失败：邮箱认证失败，请检查密码、授权码或 OAuth 数据': 'Kiểm tra thất bại: xác thực hộp thư thất bại. Kiểm tra mật khẩu, mã ứng dụng hoặc dữ liệu OAuth',
            'Microsoft OAuth 拒绝该账号登录，账号处于 service abuse mode': 'Microsoft OAuth từ chối đăng nhập vì tài khoản ở chế độ service abuse',
            'OAuth 令牌获取失败': 'Lấy token OAuth thất bại',
            '邮箱认证失败': 'Xác thực hộp thư thất bại',
            'SSL 连接失败': 'Kết nối SSL thất bại',
            '未找到邮箱信息': 'Không tìm thấy hộp thư',
            '所有邮件已存在，未发现新邮件': 'Tất cả thư đã tồn tại. Không có thư mới.',
            '邮箱中暂无新邮件': 'Hộp thư chưa có thư mới',
            '收件失败，详情已显示在弹窗内': 'Lấy thư thất bại. Chi tiết đã hiển thị trong cửa sổ.',
            '网络错误，详情已显示在弹窗内': 'Lỗi mạng. Chi tiết đã hiển thị trong cửa sổ.',
            '请填写完整的邮箱信息后再测试': 'Vui lòng điền đầy đủ thông tin hộp thư trước khi kiểm tra',
            '邮箱连接测试成功': 'Kiểm tra kết nối hộp thư thành công',
            '测试请求失败，请检查服务是否正常运行': 'Yêu cầu kiểm tra thất bại. Vui lòng kiểm tra dịch vụ có đang chạy không.',
            '请填写收件人地址': 'Vui lòng nhập địa chỉ người nhận',
            '发送成功': 'Gửi thành công',
            '发送失败': 'Gửi thất bại',
            '确定要删除这个邮箱账号吗？': 'Xóa tài khoản hộp thư này?',
            '邮箱删除成功': 'Đã xóa hộp thư',
            '删除失败': 'Xóa thất bại',
            '请填写完整的收/发件服务器信息': 'Vui lòng điền đầy đủ thông tin máy chủ nhận/gửi',
            '保存成功': 'Đã lưu',
            '保存失败': 'Lưu thất bại',
            '请填写所有必需字段': 'Vui lòng điền tất cả mục bắt buộc',
            '批量添加成功': 'Thêm hàng loạt thành công',
            '批量添加失败': 'Thêm hàng loạt thất bại',
            '邮箱地址为空': 'Địa chỉ hộp thư trống',
            '选中的邮箱不存在': 'Hộp thư đã chọn không tồn tại',
            '请选择要分组的邮箱': 'Vui lòng chọn hộp thư cần phân nhóm',
            '请选择要删除的邮箱': 'Vui lòng chọn hộp thư cần xóa',
            '批量删除成功': 'Xóa hàng loạt thành công',
            '批量删除失败': 'Xóa hàng loạt thất bại',
            '请填写完整的服务器信息': 'Vui lòng điền đầy đủ thông tin máy chủ',
            '服务器保存成功': 'Đã lưu máy chủ',
            '服务器保存失败': 'Lưu máy chủ thất bại',
            '确定要删除这个服务器配置吗？': 'Xóa cấu hình máy chủ này?',
            '服务器删除成功': 'Đã xóa máy chủ',
            '请选择要删除的服务器': 'Vui lòng chọn máy chủ cần xóa',
            '获取邮箱信息失败': 'Lấy thông tin hộp thư thất bại',
            '邮箱ID缺失': 'Thiếu ID hộp thư',
            '备注保存成功': 'Đã lưu ghi chú',

            '邮件收件日志': 'Nhật ký nhận thư',
            '日志总数': 'Tổng nhật ký',
            '成功收取': 'Lấy thành công',
            '失败记录': 'Bản ghi thất bại',
            '轮询间隔': 'Khoảng poll',
            '关键词：邮箱、主题、发件人、正文': 'Từ khóa: hộp thư, tiêu đề, người gửi, nội dung',
            '全部状态': 'Tất cả trạng thái',
            '已处理': 'Đã xử lý',
            '全部管理员': 'Tất cả quản trị',
            '查询': 'Tìm',
            '清空': 'Xóa',
            '立即查询': 'Truy vấn ngay',
            '批量筛选': 'Lọc hàng loạt',
            '批量邮箱筛选：每行或逗号分隔多个邮箱': 'Lọc hộp thư hàng loạt: mỗi dòng một hộp thư hoặc phân tách bằng dấu phẩy',
            '批量主题筛选：每行或逗号分隔多个关键词': 'Lọc tiêu đề hàng loạt: mỗi dòng một từ khóa hoặc phân tách bằng dấu phẩy',
            '批量发件人筛选：每行或逗号分隔多个发件人': 'Lọc người gửi hàng loạt: mỗi dòng một người gửi hoặc phân tách bằng dấu phẩy',
            '最近开始': 'Bắt đầu gần nhất',
            '最近结束': 'Kết thúc gần nhất',
            '结果': 'Kết quả',
            '收件日志详情': 'Chi tiết nhật ký nhận thư',
            '自动轮询': 'Tự động poll',
            '手动轮询': 'Poll thủ công',
            '后台取件': 'Quản trị lấy thư',
            '卡密接口': 'API mã',
            '卡密预览': 'Xem trước mã',
            '手动': 'Thủ công',
            '验证码': 'Mã xác minh',
            '管理员': 'Quản trị',
            '主题 / 摘要': 'Tiêu đề / Tóm tắt',
            '收件时间': 'Thời gian nhận',
            '详情': 'Chi tiết',
            '最后查询': 'Truy vấn cuối',
            '暂无收件日志': 'Chưa có nhật ký nhận thư',
            '日志ID': 'ID nhật ký',
            '收件邮箱': 'Hộp thư nhận',
            '来源': 'Nguồn',
            '记录': 'Bản ghi',
            '处理建议': 'Gợi ý xử lý',
            '错误详情': 'Chi tiết lỗi',
            '检查邮箱密码/授权码是否正确，确认邮箱已开启 IMAP，并确认账号没有触发安全拦截。': 'Kiểm tra mật khẩu/mã ứng dụng, xác nhận IMAP đã bật và tài khoản không bị chặn bảo mật.',
            '检查收件服务器端口和 SSL 开关是否匹配；常见 IMAP SSL 使用 993，STARTTLS 或非 SSL 配置不要使用隐式 SSL。': 'Kiểm tra cổng máy chủ nhận có khớp với SSL không. IMAP SSL thường dùng 993; STARTTLS hoặc không SSL không nên dùng SSL ẩn.',
            '检查服务器地址、端口、网络连通性和代理配置。': 'Kiểm tra địa chỉ máy chủ, cổng, kết nối mạng và cấu hình proxy.',
            '检查服务器域名是否填写正确，或当前网络是否能解析该域名。': 'Kiểm tra tên miền máy chủ có đúng và mạng hiện tại có phân giải được không.',
            '根据完整错误检查邮箱账号、授权码、服务器地址、端口、SSL 和代理配置。': 'Dựa trên lỗi đầy đủ để kiểm tra tài khoản hộp thư, mã ứng dụng, địa chỉ máy chủ, cổng, SSL và proxy.',
            '这条是收取失败记录，没有实际邮件正文。请查看下方错误详情。': 'Đây là bản ghi lấy thất bại nên không có nội dung thư. Xem chi tiết lỗi bên dưới.',
            '这条记录没有保存正文。重新收取或轮询成功后，这里会显示实际邮件内容。': 'Bản ghi này chưa lưu nội dung. Sau khi lấy hoặc poll thành công, nội dung thư sẽ hiển thị tại đây.',
            '登录状态已失效，请重新登录': 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.',
            '获取收件日志失败': 'Tải nhật ký nhận thư thất bại',
            '启动中...': 'Đang khởi động...',
            '已开始轮询': 'Đã bắt đầu poll',
            '轮询启动失败': 'Khởi động poll thất bại',

            'API取件页面': 'Trang lấy thư API',
            '此卡密不存在': 'Mã này không tồn tại',
            '请检查卡密是否正确，或联系管理员获取有效卡密': 'Vui lòng kiểm tra mã hoặc liên hệ quản trị viên',
            '复制': 'Sao chép'
        }
    };

    // Shared by the React shell and legacy screens; keep locale dictionaries in sync.
    const sharedMessages = {
        '自定义': ['Custom', 'Tùy chỉnh'],
        '自定义每页条数': ['Custom rows per page', 'Số dòng tùy chỉnh mỗi trang'],
        '请输入 1–10000 之间的整数': ['Enter a whole number from 1 to 10000', 'Nhập số nguyên từ 1 đến 10000'],
        '应用': ['Apply', 'Áp dụng'],
        '导入格式说明': ['Import formats', 'Định dạng nhập'],
        '每行一个邮箱，也支持 JSON 数组、CSV/TSV 表头和分行字段。': ['One mailbox per line. JSON arrays, CSV/TSV headers and multiline fields are also supported.', 'Mỗi dòng một hộp thư. Hỗ trợ mảng JSON, tiêu đề CSV/TSV và trường nhiều dòng.'],
        '支持中英文逗号、分号、竖线、冒号、Tab、空格、JSON、key=value': ['Supports commas, semicolons, pipes, colons, tabs, spaces, JSON and key=value.', 'Hỗ trợ dấu phẩy, chấm phẩy, dấu gạch đứng, hai chấm, Tab, khoảng trắng, JSON và key=value.'],
        '前台密钥': ['Public access key', 'Khóa truy cập trang nhận thư'],
        '前台取件需要密钥': ['Require a key to retrieve mail publicly', 'Yêu cầu khóa để nhận thư công khai'],
        '开启后，前台显示密钥输入框，验证通过后才能取件；关闭后恢复邮箱直接取件。': ['When enabled, the public page requires a valid key to retrieve mail. When disabled, an email address is sufficient.', 'Khi bật, trang nhận thư yêu cầu khóa hợp lệ. Khi tắt, chỉ cần địa chỉ email để nhận thư.'],
        '此开关仅 tjt740 本人可见、可修改。': ['Only tjt740 can see and change this setting.', 'Chỉ tjt740 có thể xem và thay đổi cài đặt này.'],
        '正在读取取件设置…': ['Loading mail access settings…', 'Đang tải cài đặt nhận thư…'],
        '已开启：前台取件必须验证密钥': ['Enabled: public mail retrieval requires a valid key', 'Đã bật: cần khóa hợp lệ để nhận thư công khai'],
        '已关闭：前台可直接用邮箱取件': ['Disabled: retrieve public mail using an email address', 'Đã tắt: nhận thư trực tiếp bằng địa chỉ email'],
        '前台密钥设置已保存': ['Public access key settings saved', 'Đã lưu cài đặt khóa nhận thư'],
        '暂时无法确认取件设置，请刷新页面重试': ['Unable to confirm mail access settings. Refresh the page to retry.', 'Chưa thể xác nhận cài đặt nhận thư. Hãy tải lại trang để thử lại.'],
        '请先设置万能秘钥，再开启前台密钥取件': ['Set a master key before enabling key-protected mail retrieval', 'Hãy đặt khóa chính trước khi bật yêu cầu khóa nhận thư'],
        '请选择开启或关闭': ['Choose enabled or disabled', 'Chọn bật hoặc tắt'],
        '无权修改前台密钥设置': ['You cannot change public access key settings', 'Bạn không có quyền thay đổi cài đặt khóa nhận thư'],
        '取件密钥': ['Mail access key', 'Khóa nhận thư'],
        '请输入取件密钥': ['Enter your mail access key', 'Nhập khóa nhận thư'],
        '验证密钥后获取邮件，密钥仅用于本次页面取件。': ['Enter a valid key to retrieve mail. The key is kept only on this page.', 'Nhập khóa hợp lệ để nhận thư. Khóa chỉ được giữ trên trang hiện tại.'],
        '请输入有效密钥后再获取邮件': ['Enter a valid key before retrieving mail', 'Nhập khóa hợp lệ trước khi nhận thư'],
        '暂时无法确认取件方式，请稍后重试': ['Mail access settings are unavailable. Please try again later.', 'Không thể xác nhận cách nhận thư. Vui lòng thử lại sau.'],
        '密钥无效或已撤销授权': ['The key is invalid or its access has been revoked', 'Khóa không hợp lệ hoặc quyền truy cập đã bị thu hồi'],
        "管理员级别": ["Administrator level", "Cấp quản trị viên"],
        "管理员层级树": ["Administrator hierarchy", "Cây phân cấp quản trị viên"],
        "个可见账号": ["visible accounts", "tài khoản hiển thị"],
        "适应画布": ["Fit to view", "Vừa khung hình"],
        "放大": ["Zoom in", "Phóng to"],
        "缩小": ["Zoom out", "Thu nhỏ"],
        "展开下级": ["Expand children", "Mở rộng cấp dưới"],
        "收起下级": ["Collapse children", "Thu gọn cấp dưới"],
        "拖动画布 · 双指或 Ctrl + 滚轮缩放 · 点击节点查看详情": ["Drag to pan · Pinch or Ctrl + scroll to zoom · Select a node for details", "Kéo để di chuyển · Chụm hai ngón hoặc Ctrl + cuộn để thu phóng · Chọn nút để xem chi tiết"],
        "仅展示上级关系": ["Parent relationship only", "Chỉ hiển thị quan hệ cấp trên"],
        "子级管理员": ["Child administrator", "Quản trị viên cấp dưới"],
        "暂无管理员": ["No administrators", "Chưa có quản trị viên"],
        "已更新层级树": ["Hierarchy updated", "Đã cập nhật cây phân cấp"],
        "查看层级与授权规则": ["View hierarchy and permission rules", "Xem quy tắc phân cấp và phân quyền"],
        "一级管理员": ["Level 1 administrator", "Quản trị viên cấp 1"],
        "二级管理员": ["Level 2 administrator", "Quản trị viên cấp 2"],
        "三级管理员": ["Level 3 administrator", "Quản trị viên cấp 3"],
        "内置管理员": ["Built-in administrator", "Quản trị viên có sẵn"],
        "一级管理员可创建二级或三级；二级管理员可创建直属三级；三级管理员不能再创建下级。新账号默认不授予功能权限。": ["Level 1 can create level 2 or 3 accounts. Level 2 can create direct level 3 accounts. Level 3 cannot create further accounts. New accounts have no feature permissions by default.", "Cấp 1 có thể tạo tài khoản cấp 2 hoặc 3. Cấp 2 có thể tạo cấp 3 trực thuộc. Cấp 3 không thể tạo thêm cấp dưới. Tài khoản mới mặc định chưa có quyền chức năng."],
        "tjt740 为一级；lhm、pink 为内置二级，保留原有功能权限和邮箱范围，不参与普通子账号的功能授权。": ["tjt740 is level 1. lhm and pink are built-in level 2 administrators with their existing feature permissions and mailbox scopes; they are excluded from ordinary child-account permission settings.", "tjt740 là cấp 1. lhm và pink là quản trị viên cấp 2 có sẵn, giữ nguyên quyền chức năng và phạm vi hộp thư; không áp dụng cài đặt quyền của tài khoản con thông thường."],
        "三级管理员不能创建或管理下级": ["Level 3 administrators cannot create or manage child accounts.", "Quản trị viên cấp 3 không thể tạo hoặc quản lý tài khoản cấp dưới."],
        "管理员级别必须为二级或三级": ["Choose administrator level 2 or 3.", "Chọn quản trị viên cấp 2 hoặc 3."],
        "只有一级管理员可以创建二级管理员": ["Only level 1 administrators can create level 2 administrators.", "Chỉ quản trị viên cấp 1 mới có thể tạo quản trị viên cấp 2."],
        "归属上级的级别必须高于新管理员": ["The parent must have a higher administrator level than the new account.", "Quản trị viên cấp trên phải có cấp cao hơn tài khoản mới."],
        "内置管理员用户名已保留": ["Built-in administrator usernames are reserved.", "Tên đăng nhập quản trị viên có sẵn được dành riêng."],
        "归属上级（可选）": ["Parent administrator (optional)", "Quản trị viên cấp trên (không bắt buộc)"],
        "普通管理员仅能管理直属下级；最高管理员可查看全部账号。新账号默认不授予功能权限。": ["Administrators can only manage their direct reports; super administrators can view all accounts. New accounts have no feature permissions by default.", "Quản trị viên chỉ có thể quản lý cấp dưới trực tiếp; quản trị viên cao nhất có thể xem tất cả tài khoản. Tài khoản mới mặc định chưa được cấp quyền chức năng."],
        "不指定（默认归属当前管理员）": ["Default to the current administrator", "Mặc định là quản trị viên hiện tại"],
        "不选择时，新账号归属当前管理员。": ["If left blank, the new account belongs to the current administrator.", "Nếu không chọn, tài khoản mới sẽ thuộc quản trị viên hiện tại."],
        "归属上级格式错误，请重新选择": ["Invalid parent administrator. Please select again.", "Quản trị viên cấp trên không hợp lệ. Vui lòng chọn lại."],
        "只能将新管理员归属到自己名下": ["You can only create administrators under your own account.", "Bạn chỉ có thể tạo quản trị viên trực thuộc tài khoản của mình."],
        "归属上级不存在，请刷新后重新选择": ["The parent administrator no longer exists. Refresh and select again.", "Quản trị viên cấp trên không còn tồn tại. Hãy tải lại và chọn lại."],
        "请先为目标管理员的上级授予所需权限": ["Grant the required permissions to the parent administrator first.", "Trước tiên, hãy cấp các quyền cần thiết cho quản trị viên cấp trên."],
        "归属上级": ["Parent administrator", "Quản trị viên cấp trên"],
        "最高管理员": ["Super administrator", "Quản trị viên cao nhất"],
        "功能授权": ["Feature permissions", "Cấp quyền chức năng"],
        "保存功能授权": ["Save permissions", "Lưu quyền"],
        "不可管理": ["Cannot manage", "Không thể quản lý"],
        "首页统计": ["Dashboard statistics", "Thống kê trang chủ"],
        "查看全部邮箱（跨账号）": ["View all mailboxes (all accounts)", "Xem mọi hộp thư (mọi tài khoản)"],
        "代理池管理（全站）": ["Proxy management (site-wide)", "Quản lý proxy (toàn hệ thống)"],
        "卡密管理（全站）": ["Card management (site-wide)", "Quản lý mã thẻ (toàn hệ thống)"],
        "卡密日志（全站）": ["Card logs (site-wide)", "Nhật ký mã thẻ (toàn hệ thống)"],
        "系统设置（标题、服务器、轮询）": ["System settings (titles, servers, polling)", "Cài đặt hệ thống (tiêu đề, máy chủ, thăm dò)"],
        "管理直属下级及功能授权": ["Manage direct reports and their permissions", "Quản lý cấp dưới trực tiếp và quyền"],
        "授权直属下级邮箱范围": ["Grant mailbox access to direct reports", "Cấp quyền hộp thư cho cấp dưới trực tiếp"],
        "设置和使用本人万能密钥": ["Set and use own master key", "Đặt và sử dụng khóa tổng cá nhân"],
        "展示系统整体状态：邮箱账号、卡密、代理数量与自动轮询运行情况。点击功能导航卡片进入各模块。": ["Shows mailbox, key and proxy totals, plus automatic polling status. Select a navigation card to open a module.", "Hiển thị tổng số hộp thư, mã, proxy và trạng thái lấy thư tự động. Chọn thẻ điều hướng để mở chức năng."],
        "邮箱账号总数：已配置的收件邮箱数量。": ["Total mailboxes: the number of configured receiving accounts.", "Tổng số hộp thư: số tài khoản nhận thư đã cấu hình."],
        "卡密总数：已生成的卡密数量。": ["Total card keys: the number of generated keys.", "Tổng số mã: số mã đã tạo."],
        "可用代理数量：代理池中可用的代理数。": ["Available proxies: the number of usable proxies in the pool.", "Proxy khả dụng: số proxy có thể sử dụng trong nhóm."],
        "自动轮询：后台定时收件的当前状态（运行中 / 空闲 / 已暂停 / 已禁用）。": ["Automatic polling: the current scheduled mail retrieval status (running / idle / paused / disabled).", "Lấy thư tự động: trạng thái lấy thư theo lịch (đang chạy / rảnh / tạm dừng / đã tắt)."],
        "配置用于收件的邮箱账号，支持单个 / 批量添加、分组、测试连通性、手动收件与发件。": ["Configure receiving accounts individually or in bulk, organize groups, test connections, and receive or send mail manually.", "Cấu hình tài khoản nhận thư riêng lẻ hoặc hàng loạt, sắp xếp nhóm, kiểm tra kết nối, nhận và gửi thư thủ công."],
        "「添加邮箱」下拉：单个添加、批量添加、添加服务器地址。": ["The Add Mailbox menu supports individual accounts, bulk imports and server addresses.", "Menu Thêm hộp thư hỗ trợ thêm riêng lẻ, nhập hàng loạt và địa chỉ máy chủ."],
        "需填写邮箱、密码/授权码、IMAP/SMTP 服务器与端口；可选 SSL。": ["Enter the email, password or app password, and IMAP/SMTP server and port. SSL is optional.", "Nhập email, mật khẩu hoặc mã ứng dụng, máy chủ và cổng IMAP/SMTP. SSL là tùy chọn."],
        "OAuth 邮箱（如 Outlook）在备注标记「OAuth登录」，通过刷新令牌收件。": ["OAuth accounts (such as Outlook) are marked “OAuth登录” in Notes and use refresh tokens to retrieve mail.", "Tài khoản OAuth (như Outlook) được đánh dấu “OAuth登录” trong ghi chú và dùng refresh token để lấy thư."],
        "勾选多行后，底部会滑出批量操作条：批量复制、批量分组、批量删除。": ["Selecting multiple rows opens the bottom action bar for copying, grouping and deleting selected accounts.", "Chọn nhiều dòng để mở thanh thao tác bên dưới: sao chép, phân nhóm và xóa các tài khoản đã chọn."],
        "「视图」按钮可切换分组显示与自定义显示列。": ["Use the view controls to toggle groups and customize visible columns.", "Dùng điều khiển chế độ xem để bật/tắt nhóm và tùy chỉnh các cột hiển thị."],
        "编辑 / 收件 / 测试 / 删除 / 更多（备注、发件等）。": ["Edit / Receive / Test / Delete / More (notes, sending mail, etc.).", "Sửa / Nhận thư / Kiểm tra / Xóa / Thêm (ghi chú, gửi thư, v.v.)."],
        "测试：验证邮箱能否正常登录收件；状态列显示「邮箱正常 / 异常 / 未检测」。": ["Test verifies mailbox login and mail retrieval. The status column shows whether the account is healthy, has an error, or has not been tested.", "Kiểm tra xác minh đăng nhập và nhận thư. Cột trạng thái cho biết tài khoản bình thường, có lỗi hoặc chưa kiểm tra."],
        "管理 HTTP / SOCKS5 代理，用于通过代理连接邮箱服务器，降低直连被限制的风险。": ["Manage HTTP/SOCKS5 proxies for connecting to mail servers and reducing direct connection restrictions.", "Quản lý proxy HTTP/SOCKS5 để kết nối máy chủ thư và giảm hạn chế kết nối trực tiếp."],
        "支持添加 HTTP 与 SOCKS5 两类代理。": ["Both HTTP and SOCKS5 proxies are supported.", "Hỗ trợ cả proxy HTTP và SOCKS5."],
        "「开启代理」会自动选择延迟最低的代理；也可手动切换到指定代理。": ["Enable proxy automatically selects the server with the lowest latency. You can also select one manually.", "Bật proxy tự chọn máy chủ có độ trễ thấp nhất. Bạn cũng có thể chọn thủ công."],
        "密码列默认打码，点击眼睛图标显示、点击复制图标复制。": ["Passwords are masked by default. Use the eye icon to reveal them or the copy icon to copy them.", "Mật khẩu mặc định được che. Nhấn biểu tượng mắt để hiển thị hoặc biểu tượng sao chép để sao chép."],
        "当前所有邮箱共用同一个启用中的代理，是潜在的单点瓶颈（见帮助中心的轮询说明）。": ["All mailboxes currently share the active proxy, which can become a bottleneck. See the polling guide in the Help Center.", "Mọi hộp thư hiện dùng chung proxy đang bật, có thể tạo nút thắt. Xem hướng dẫn lấy thư trong Trung tâm trợ giúp."],
        "生成并管理访问卡密。卡密是前台用户查看邮件的凭证，可限制使用次数、有效期与绑定邮箱。": ["Generate and manage access keys for viewing mail, with usage limits, expiry dates and mailbox bindings.", "Tạo và quản lý mã truy cập để xem thư, với giới hạn sử dụng, thời hạn và liên kết hộp thư."],
        "单个生成或批量生成；可设置使用次数上限、有效期、收取范围（天数）与关键词过滤。": ["Generate one key or a batch. Set usage limits, expiry, mail age in days and keyword filters.", "Tạo một mã hoặc hàng loạt. Đặt giới hạn sử dụng, thời hạn, số ngày lấy thư và bộ lọc từ khóa."],
        "可将卡密绑定到一个或多个邮箱，绑定后该卡密只能查询这些邮箱。": ["Bind a key to one or more mailboxes to restrict it to those accounts.", "Liên kết mã với một hoặc nhiều hộp thư để giới hạn mã chỉ truy vấn các tài khoản đó."],
        "使用情况：已用次数 / 上限，下方为最近使用时间。": ["Usage: uses consumed / limit, with the most recent use shown below.", "Sử dụng: số lần đã dùng / giới hạn, bên dưới là lần dùng gần nhất."],
        "有效期：到期时间，留空为永久有效。": ["Validity: the expiry date; blank means no expiry.", "Thời hạn: ngày hết hạn; để trống nghĩa là không hết hạn."],
        "备注 / 过滤：备注文字与收取范围、关键词过滤。": ["Notes / Filters: notes, mail age limits and keyword filters.", "Ghi chú / Bộ lọc: ghi chú, giới hạn tuổi thư và từ khóa."],
        "删除或过期的卡密进入回收站，可恢复或彻底清理。": ["Deleted or expired keys go to the recycle bin, where they can be restored or permanently removed.", "Mã đã xóa hoặc hết hạn vào thùng rác, có thể khôi phục hoặc xóa vĩnh viễn."],
        "记录每次卡密的使用与查询：谁在什么时间用哪个卡密查询了哪个邮箱。": ["Records key use and queries: who accessed which mailbox, with which key, and when.", "Ghi lại việc dùng mã và truy vấn: ai truy cập hộp thư nào, bằng mã nào và khi nào."],
        "卡密 / 绑定邮箱 / 邮件标题 / 使用者IP / 使用时间（北京时间）。": ["Key / Bound mailbox / Mail subject / User IP / Usage time (Beijing time).", "Mã / Hộp thư liên kết / Tiêu đề thư / IP người dùng / Thời gian dùng (giờ Bắc Kinh)."],
        "action=use 表示成功取件；action=check 表示查询了卡密信息（不消耗次数）。": ["action=use means mail was retrieved successfully; action=check is a key information query and does not consume a use.", "action=use nghĩa là lấy thư thành công; action=check là truy vấn thông tin mã và không tiêu hao lượt dùng."],
        "「保留天数」设为 0 表示不清理；设为 N 表示自动删除 N 天前的卡密日志。": ["Set retention to 0 to keep all logs, or to N to automatically delete key logs older than N days.", "Đặt số ngày lưu là 0 để giữ mọi nhật ký, hoặc N để tự xóa nhật ký mã cũ hơn N ngày."],
        "查看后台自动收件的结果，并控制自动轮询的开关、间隔、日志保留与失败退避。": ["View automatic mail retrieval results and control polling, intervals, log retention and failure backoff.", "Xem kết quả lấy thư tự động và điều khiển lấy thư, khoảng cách, lưu nhật ký và tạm ngưng khi lỗi."],
        "自动轮询：后台按间隔定时收取所有启用邮箱的最新邮件。": ["Automatic polling retrieves the latest mail from all enabled mailboxes at the configured interval.", "Lấy thư tự động lấy thư mới nhất từ mọi hộp thư đang bật theo khoảng cách đã cấu hình."],
        "立即查询：手动触发一次轮询（会忽略失败退避，相当于立即重试）。": ["Query now manually starts one polling round, ignoring backoff so failed accounts are retried immediately.", "Truy vấn ngay khởi động một lượt lấy thư thủ công, bỏ qua tạm ngưng để thử lại tài khoản lỗi ngay."],
        "状态值：received 成功 / failed 失败 / processed 已处理。": ["Statuses: received / failed / processed.", "Trạng thái: received (đã nhận) / failed (thất bại) / processed (đã xử lý)."],
        "自动轮询开关：关闭后暂停定时收件，约 30 秒内生效，无需重启。": ["Turning automatic polling off pauses scheduled retrieval within about 30 seconds, without restarting.", "Tắt lấy thư tự động để tạm dừng trong khoảng 30 giây, không cần khởi động lại."],
        "间隔(秒)：两次轮询之间的等待时间，最低 30 秒。": ["Interval (seconds): the wait between polling rounds, with a minimum of 30 seconds.", "Khoảng cách (giây): thời gian chờ giữa các lượt lấy thư, tối thiểu 30 giây."],
        "日志保留(天)：0 为不清理；设为 N 自动删除 N 天前的收件日志，防止数据库膨胀。": ["Retention (days): 0 keeps all logs; N automatically deletes mail logs older than N days to limit database growth.", "Lưu nhật ký (ngày): 0 giữ tất cả; N tự xóa nhật ký nhận thư cũ hơn N ngày để hạn chế kích thước cơ sở dữ liệu."],
        "退避中 N 个：连续失败的邮箱会被暂时跳过，可展开查看并重置。": ["Accounts in backoff: repeatedly failing mailboxes are temporarily skipped. Expand the list to inspect or reset them.", "Tài khoản đang tạm ngưng: hộp thư lỗi liên tiếp bị bỏ qua tạm thời. Mở danh sách để xem hoặc đặt lại."],
        "每个邮箱每轮抓取最新 5 封、仅看最近 7 天、仅 INBOX。": ["Each round fetches the latest 5 messages per mailbox, from the last 7 days, in INBOX only.", "Mỗi lượt lấy 5 thư mới nhất mỗi hộp thư, trong 7 ngày gần nhất, chỉ từ INBOX."],
        "按「邮箱 + Message-ID」去重，避免重复记录。": ["Messages are deduplicated by mailbox and Message-ID to avoid duplicate logs.", "Loại thư trùng theo hộp thư và Message-ID để tránh nhật ký trùng."],
        "连续失败达阈值（默认 3 次）后进入指数退避（跳过 2→4→8→16 轮），成功后自动恢复。": ["After consecutive failures reach the threshold (3 by default), exponential backoff skips 2→4→8→16 rounds. Successful retrieval resets backoff.", "Khi lỗi liên tiếp đạt ngưỡng (mặc định 3), tạm ngưng theo cấp số nhân bỏ qua 2→4→8→16 lượt. Lấy thư thành công sẽ đặt lại."],
        "管理管理员账号、万能秘钥、系统与页面标题等。左侧锚点可快速跳转到各设置区块。": ["Manage admin accounts, the master key and system/page titles. Use the left navigation to jump to a settings section.", "Quản lý tài khoản quản trị, khóa chính và tiêu đề hệ thống/trang. Dùng điều hướng bên trái để đến mục cài đặt."],
        "管理员账号：修改当前管理员用户名与密码。": ["Admin account: change your username and password.", "Tài khoản quản trị: đổi tên đăng nhập và mật khẩu của bạn."],
        "后台管理员管理：新增/重置/删除其它管理员账号。": ["Manage admins: add, reset or delete other administrator accounts.", "Quản lý quản trị viên: thêm, đặt lại hoặc xóa tài khoản quản trị khác."],
        "万能秘钥：一个无需卡密即可查询任意邮箱的超级凭证，请妥善保管。": ["Master key: a credential that can query any mailbox without a card key. Keep it secure.", "Khóa chính: thông tin xác thực để truy vấn mọi hộp thư không cần mã. Hãy bảo quản an toàn."],
        "系统标题 / 页面标题：自定义站点显示名称。": ["System / Page titles: customize the names displayed on the site.", "Tiêu đề hệ thống / trang: tùy chỉnh tên hiển thị trên trang web."],
        "为什么收不到邮件？": ["Why am I not receiving mail?", "Tại sao tôi không nhận được thư?"],
        "① 邮箱配置或授权码错误——用「测试」按钮验证；② 该邮箱触发了失败退避，被暂时跳过——在收件日志页展开退避列表并重置；③ 使用了 OAuth 的邮箱刷新令牌失效；④ 代理不可用导致连接失败。": ["Possible causes: incorrect mailbox settings or app password (use Test); the mailbox is in backoff (expand and reset it in Mail Logs); an expired OAuth refresh token; or an unavailable proxy.", "Nguyên nhân có thể: sai cấu hình hoặc mã ứng dụng (dùng Kiểm tra); hộp thư đang tạm ngưng (mở và đặt lại trong Nhật ký thư); refresh token OAuth hết hạn; hoặc proxy không khả dụng."],
        "自动轮询多久收一次？": ["How often does automatic polling run?", "Lấy thư tự động chạy bao lâu một lần?"],
        "由「轮询间隔」决定，默认 300 秒（5 分钟），最低 30 秒。可在收件日志页的轮询控制面板调整，改动在当前周期结束后生效。": ["The polling interval defaults to 300 seconds (5 minutes), with a 30-second minimum. Change it in Mail Logs; it takes effect after the current round.", "Khoảng cách mặc định là 300 giây (5 phút), tối thiểu 30 giây. Đổi trong Nhật ký thư; có hiệu lực sau lượt hiện tại."],
        "卡密的使用次数怎么算？": ["How are key uses counted?", "Lượt sử dụng mã được tính thế nào?"],
        "每成功取件一次消耗一次；查询卡密信息（check）不消耗次数。次数用完后卡密变为「次数用完」状态，无法再查询。": ["Each successful retrieval consumes one use. A key information query (check) does not. Once the limit is reached, the key is exhausted and cannot query mail.", "Mỗi lần lấy thư thành công tiêu hao một lượt. Truy vấn thông tin mã (check) không tiêu hao. Khi hết lượt, mã không thể truy vấn thư."],
        "代理怎么用？": ["How do I use a proxy?", "Làm thế nào để dùng proxy?"],
        "在代理池添加 HTTP/SOCKS5 代理后点击「开启代理」，系统会自动选延迟最低的代理连接邮箱；也可手动切换。": ["Add an HTTP/SOCKS5 proxy in Proxy Pool, then enable it. The lowest latency proxy is selected automatically; you can also switch manually.", "Thêm proxy HTTP/SOCKS5 trong Nhóm proxy rồi bật. Proxy có độ trễ thấp nhất được chọn tự động; bạn cũng có thể đổi thủ công."],
        "失败退避是什么？": ["What is failure backoff?", "Tạm ngưng thử lại khi lỗi là gì?"],
        "连续失败达到阈值（默认 3 次）的邮箱会被暂时跳过 2→4→8→16 轮，避免反复空耗子进程与触发服务商限流；该邮箱一旦成功收件就自动恢复正常频率。": ["After repeated failures reach the threshold (3 by default), a mailbox skips 2→4→8→16 rounds to avoid wasted work and provider rate limits. Successful retrieval restores its normal frequency.", "Khi lỗi liên tiếp đạt ngưỡng (mặc định 3), hộp thư bỏ qua 2→4→8→16 lượt để tránh lãng phí và giới hạn nhà cung cấp. Lấy thư thành công sẽ khôi phục tần suất bình thường."],
        "收件日志越来越多怎么办？": ["How do I limit growing mail logs?", "Làm sao hạn chế nhật ký thư tăng lên?"],
        "在收件日志页把「日志保留天数」设为一个正数（如 30），系统会自动清理更早的日志。默认 0 为不清理，长期运行建议开启。": ["Set log retention in Mail Logs to a positive number, such as 30, to delete older logs automatically. The default of 0 keeps everything; enable cleanup for long-running systems.", "Đặt số ngày lưu nhật ký trong Nhật ký thư thành số dương, như 30, để tự xóa nhật ký cũ. Mặc định 0 giữ tất cả; nên bật dọn dẹp khi chạy lâu dài."],
        "页面操作": ["Page actions", "Thao tác trang"],
        "邮箱账号总数": ["Total mailboxes", "Tổng số hộp thư"],
        "卡密总数": ["Total card keys", "Tổng số mã"],
        "可用代理数量": ["Available proxies", "Proxy khả dụng"],
        "空闲": ["Idle", "Đang rảnh"],
        "功能导航": ["Navigation", "Điều hướng"],
        "使用说明": ["User guide", "Hướng dẫn sử dụng"],
        "欢迎使用邮件查看系统管理控制台，点击下方卡片进入对应模块。": ["Welcome to the mail admin console. Select a card below to open a module.", "Chào mừng đến bảng quản trị thư. Chọn thẻ bên dưới để mở chức năng."],
        "添加、编辑和删除邮箱账号配置": ["Add, edit and delete mailbox accounts", "Thêm, sửa và xóa tài khoản hộp thư"],
        "管理代理服务器配置": ["Manage proxy servers", "Quản lý máy chủ proxy"],
        "生成和管理访问卡密": ["Generate and manage access keys", "Tạo và quản lý mã truy cập"],
        "查看卡密使用记录": ["View card usage history", "Xem lịch sử sử dụng mã"],
        "查看邮件接收记录与轮询控制": ["View mail logs and polling controls", "Xem nhật ký nhận thư và điều khiển lấy thư"],
        "配置系统参数和安全选项": ["Configure system and security settings", "Cấu hình hệ thống và bảo mật"],
        "首页 · 概览": ["Home · Overview", "Trang chủ · Tổng quan"],
        "常见问题": ["Frequently asked questions", "Câu hỏi thường gặp"],
        "统计卡片": ["Statistics cards", "Thẻ thống kê"],
        "前往帮助中心查看全部说明 →": ["View all guides in the Help Center →", "Xem mọi hướng dẫn tại Trung tâm trợ giúp →"],
        "单个添加": ["Add one", "Thêm một"],
        "发送": ["Send", "Gửi"],
        "（可选，粘贴后自动填充）": ["(Optional; paste to autofill)", "(Tùy chọn; dán để tự điền)"],
        "支持 ---- / 冒号 / 竖线 / 逗号 / 分号 / Tab / 空格 / key=value / JSON / CSV 表头": ["Supports ----, colons, pipes, commas, semicolons, tabs, spaces, key=value, JSON and CSV headers", "Hỗ trợ ----, dấu hai chấm, gạch dọc, dấu phẩy, chấm phẩy, tab, khoảng trắng, key=value, JSON và tiêu đề CSV"],
        "测试邮箱": ["Test mailbox", "Kiểm tra hộp thư"],
        "批量操作": ["Batch actions", "Thao tác hàng loạt"],
        "行内操作": ["Row actions", "Thao tác trên dòng"],
        "展开分组": ["Expand groups", "Mở rộng nhóm"],
        "展开左侧分组": ["Expand the groups sidebar", "Mở thanh nhóm bên trái"],
        "清除搜索": ["Clear search", "Xóa tìm kiếm"],
        "搜索邮件": ["Search emails", "Tìm kiếm thư"],
        "搜索结果": ["Search results", "Kết quả tìm kiếm"],
        "收取数量": ["Fetch count", "Số thư lấy"],
        "搜索已收取邮件的标题、发件人或正文": ["Search received emails by subject, sender or body", "Tìm thư đã nhận theo tiêu đề, người gửi hoặc nội dung"],
        "搜索联想": ["Search suggestions", "Gợi ý tìm kiếm"],
        "没有匹配的邮件": ["No matching emails", "Không có thư phù hợp"],
        "邮件分页": ["Email pages", "Phân trang thư"],
        "按账号状态筛选": ["Filter by account status", "Lọc theo trạng thái tài khoản"],
        "倒序": ["Descending", "Giảm dần"],
        "新分组名，回车添加": ["New group name; press Enter to add", "Tên nhóm mới; nhấn Enter để thêm"],
        "添加HTTP代理": ["Add HTTP proxy", "Thêm proxy HTTP"],
        "添加SOCKS5代理": ["Add SOCKS5 proxy", "Thêm proxy SOCKS5"],
        "开启代理": ["Enable proxy", "Bật proxy"],
        "关闭代理": ["Disable proxy", "Tắt proxy"],
        "代理状态：": ["Proxy status:", "Trạng thái proxy:"],
        "未启用": ["Not enabled", "Chưa bật"],
        "点击\"开启代理\"按钮智能选择延迟最低的代理，或手动切换到指定代理": ["Enable the proxy to select the lowest latency server automatically, or select one manually", "Bật proxy để tự chọn máy chủ có độ trễ thấp nhất hoặc chọn thủ công"],
        "类型": ["Type", "Loại"],
        "代理名称": ["Proxy name", "Tên proxy"],
        "地址:端口": ["Address:port", "Địa chỉ:cổng"],
        "延迟": ["Latency", "Độ trễ"],
        "最后检测": ["Last tested", "Kiểm tra lần cuối"],
        "暂无代理配置": ["No proxies configured", "Chưa cấu hình proxy"],
        "代理地址 *": ["Proxy address *", "Địa chỉ proxy *"],
        "端口 *": ["Port *", "Cổng *"],
        "测试代理": ["Test proxy", "Kiểm tra proxy"],
        "代理管理": ["Proxy management", "Quản lý proxy"],
        "注意": ["Note", "Lưu ý"],
        "搜索代理名称、地址或备注...": ["Search proxy name, address or notes...", "Tìm tên, địa chỉ hoặc ghi chú proxy..."],
        "留空将默认为空字符串": ["Leave blank for an empty value", "Để trống nếu không có giá trị"],
        "可选：代理用户名": ["Optional: proxy username", "Tùy chọn: tên đăng nhập proxy"],
        "可选：代理密码": ["Optional: proxy password", "Tùy chọn: mật khẩu proxy"],
        "可选：代理备注": ["Optional: proxy notes", "Tùy chọn: ghi chú proxy"],
        "总卡密数": ["Total keys", "Tổng số mã"],
        "可用卡密": ["Available keys", "Mã khả dụng"],
        "已使用": ["Used", "Đã sử dụng"],
        "已过期": ["Expired", "Đã hết hạn"],
        "批量生成卡密": ["Generate keys in bulk", "Tạo mã hàng loạt"],
        "使用情况": ["Usage", "Tình hình sử dụng"],
        "有效期": ["Validity", "Thời hạn"],
        "备注 / 过滤": ["Notes / Filters", "Ghi chú / Bộ lọc"],
        "暂无卡密数据": ["No card keys", "Chưa có mã"],
        "使用次数限制": ["Usage limit", "Giới hạn sử dụng"],
        "收取X天内的邮件": ["Fetch mail from the last X days", "Lấy thư trong X ngày gần nhất"],
        "关键词邮件": ["Subject keywords", "Từ khóa tiêu đề"],
        "留空则不限制关键词": ["Leave blank to allow all subjects", "Để trống để không lọc tiêu đề"],
        "支持格式：数字天数（如：1、100）、天数+天字（如：1天、7天）或具体日期时间，留空则永不过期，使用北京时间": ["Enter a number of days (e.g. 1 or 100), days with 天 (e.g. 1天), or a date and time in Beijing time. Leave blank for no expiry.", "Nhập số ngày (ví dụ 1, 100), số ngày kèm 天 (ví dụ 1天) hoặc ngày giờ Bắc Kinh. Để trống để không hết hạn."],
        "生成数量": ["Number of keys", "Số lượng mã"],
        "最多一次生成100个": ["Up to 100 keys at a time", "Tối đa 100 mã mỗi lần"],
        "选择邮箱": ["Select mailboxes", "Chọn hộp thư"],
        "请选择邮箱账号": ["Select a mailbox account", "Chọn tài khoản hộp thư"],
        "绑定": ["Bind", "Liên kết"],
        "编辑卡密": ["Edit key", "Sửa mã"],
        "生成API": ["Generate API link", "Tạo liên kết API"],
        "邮箱分组": ["Mailbox groups", "Nhóm hộp thư"],
        "确定选择": ["Confirm selection", "Xác nhận lựa chọn"],
        "卡密回收站": ["Key recycle bin", "Thùng rác mã"],
        "已删除的卡密": ["Deleted keys", "Mã đã xóa"],
        "已过期的卡密": ["Expired keys", "Mã đã hết hạn"],
        "已删除的卡密 (": ["Deleted keys (", "Mã đã xóa ("],
        "已过期的卡密 (": ["Expired keys (", "Mã đã hết hạn ("],
        "批量恢复": ["Restore selected", "Khôi phục mục đã chọn"],
        "批量永久删除": ["Delete selected permanently", "Xóa vĩnh viễn mục đã chọn"],
        "晴天": ["Sunny", "Trời nắng"],
        "夜间": ["Night", "Ban đêm"],
        "天蓝 · 杏黄 · 薄荷绿": ["Sky blue · Apricot · Mint", "Xanh trời · Vàng mơ · Xanh bạc hà"],
        "深蓝 · 星紫 · 月光金": ["Deep blue · Violet · Moonlight gold", "Xanh đậm · Tím sao · Vàng trăng"],
        "蓝灰 · 青绿 · 霓虹玫红": ["Slate blue · Teal · Neon rose", "Xanh xám · Xanh ngọc · Hồng neon"],
        "邮局运行总览": ["Mail operations overview", "Tổng quan vận hành thư"],
        "邮箱健康、收件动态与服务状态，一眼掌握。": ["Mailbox health, mail activity and service status at a glance.", "Theo dõi tình trạng hộp thư, hoạt động nhận thư và dịch vụ."],
        "正在同步监测数据…": ["Syncing monitoring data…", "Đang đồng bộ dữ liệu giám sát…"],
        "刷新数据": ["Refresh data", "Làm mới dữ liệu"],
        "每 30 秒自动刷新 · 北京时间": ["Refreshes every 30 seconds · Beijing time", "Tự làm mới mỗi 30 giây · Giờ Bắc Kinh"],
        "最近更新": ["Last updated", "Cập nhật lần cuối"],
        "可见邮箱": ["Accessible mailboxes", "Hộp thư có thể truy cập"],
        "当前管理员可访问的邮箱": ["Mailboxes accessible to this administrator", "Hộp thư quản trị viên này có thể truy cập"],
        "正常邮箱占比": ["Healthy mailboxes", "Tỷ lệ hộp thư bình thường"],
        "按最近一次检测结果": ["Based on the latest test results", "Theo kết quả kiểm tra gần nhất"],
        "今日收件记录": ["Mail received today", "Bản ghi nhận thư hôm nay"],
        "按日志记录时间统计": ["Counted by log entry time", "Thống kê theo thời gian ghi nhật ký"],
        "今日失败记录": ["Failures today", "Bản ghi lỗi hôm nay"],
        "失败记录不等于失效邮箱": ["A failed attempt does not mean an invalid mailbox", "Một lần thất bại không có nghĩa hộp thư không hợp lệ"],
        "收件趋势": ["Mail activity", "Xu hướng nhận thư"],
        "最近 7 天 · 按日志记录数统计": ["Last 7 days · Number of log entries", "7 ngày qua · Số bản ghi nhật ký"],
        "最近七天收件与失败记录趋势": ["Mail received and failures over the last seven days", "Xu hướng nhận thư và lỗi trong bảy ngày qua"],
        "选择日期查看记录数": ["Select a date to inspect counts", "Chọn ngày để xem số bản ghi"],
        "选择下方日期查看记录数": ["Select a date below to inspect counts", "Chọn ngày bên dưới để xem số bản ghi"],
        "邮箱健康分布": ["Mailbox health", "Tình trạng hộp thư"],
        "最近一次检测结果": ["Latest test results", "Kết quả kiểm tra gần nhất"],
        "管理邮箱 →": ["Manage mailboxes →", "Quản lý hộp thư →"],
        "未检测与网络异常均不计为正常。": ["Untested mailboxes and network errors are excluded from the healthy count.", "Hộp thư chưa kiểm tra và lỗi mạng không được tính là bình thường."],
        "后台收件任务": ["Background mail collection", "Tác vụ nhận thư nền"],
        "资源余量": ["Available resources", "Tài nguyên khả dụng"],
        "代理与访问卡密": ["Proxies and access keys", "Proxy và mã truy cập"],
        "启用代理": ["Enabled proxies", "Proxy đã bật"],
        "代理启用状态不代表实时连通性。": ["Enabled status does not indicate current connectivity.", "Trạng thái bật không phản ánh kết nối hiện tại."],
        "需要关注": ["Needs attention", "Cần chú ý"],
        "邮箱检测与近期失败": ["Mailbox tests and recent failures", "Kiểm tra hộp thư và lỗi gần đây"],
        "查看收件日志 →": ["View mail logs →", "Xem nhật ký nhận thư →"],
        "无权限": ["No access", "Không có quyền"],
        "最近检测平均延迟": ["Average latency in latest tests", "Độ trễ trung bình lần kiểm tra gần nhất"],
        "需要代理池权限": ["Proxy pool access required", "Cần quyền quản lý proxy"],
        "已检测": ["Tested", "Đã kiểm tra"],
        "正常邮箱": ["Healthy mailboxes", "Hộp thư bình thường"],
        "等待下次轮询": ["Waiting for next poll", "Đang chờ lần kiểm tra tiếp theo"],
        "请求超时": ["Request timed out", "Yêu cầu hết thời gian chờ"],
        "可用卡密未过期且仍有次数": ["Available keys are unexpired with uses remaining", "Mã khả dụng chưa hết hạn và còn lượt sử dụng"],
        "需要卡密管理权限": ["Key management access required", "Cần quyền quản lý mã"],
        "上次检查邮箱": ["Mailboxes checked last run", "Hộp thư đã kiểm tra lần trước"],
        "上次新增 / 失败": ["Last run: new / failed", "Lần trước: mới / thất bại"],
        "上次完成": ["Last completed", "Hoàn tất lần cuối"],
        "下次计划": ["Next scheduled run", "Lần chạy kế tiếp"],
        "需要系统设置权限": ["System settings access required", "Cần quyền cài đặt hệ thống"],
        "近 7 天暂无失败记录": ["No failures in the last 7 days", "Không có lỗi trong 7 ngày qua"],
        "需要收件日志权限": ["Mail log access required", "Cần quyền xem nhật ký nhận thư"],
        "会话已过期，请重新登录": ["Your session expired. Please sign in again.", "Phiên đã hết hạn. Vui lòng đăng nhập lại."],
        "监测数据暂时不可用，请稍后重试": ["Monitoring data is temporarily unavailable. Please retry later.", "Dữ liệu giám sát tạm thời không khả dụng. Vui lòng thử lại sau."],
        "更新失败": ["Update failed", "Cập nhật thất bại"],
        "保留上次数据": ["Showing the last successful update", "Đang hiển thị dữ liệu cập nhật thành công gần nhất"],
        "邮箱工作台": ["Mailbox workspace", "Không gian hộp thư"],
        "邮箱分组": ["Mailbox groups", "Nhóm hộp thư"],
        "新建分组": ["New group", "Tạo nhóm"],
        "查找分组": ["Find a group", "Tìm nhóm"],
        "分组操作": ["Group actions", "Thao tác nhóm"],
        "按分组找到邮箱，点击地址即可复制。": ["Find a mailbox by group. Click its address to copy it.", "Tìm hộp thư theo nhóm. Nhấp vào địa chỉ để sao chép."],
        "在当前分组搜索邮箱、备注或服务器": ["Search addresses, notes or servers in this group", "Tìm địa chỉ, ghi chú hoặc máy chủ trong nhóm"],
        "选择邮箱分组": ["Select mailbox group", "Chọn nhóm hộp thư"],
        "展开分组侧栏": ["Show groups sidebar", "Mở thanh nhóm"],
        "收起分组侧栏": ["Hide groups sidebar", "Thu gọn thanh nhóm"],
        "展开子分组": ["Expand subgroups", "Mở rộng nhóm con"],
        "收起子分组": ["Collapse subgroups", "Thu gọn nhóm con"],
        "重置筛选": ["Reset filters", "Đặt lại bộ lọc"],
        "无效邮箱": ["Invalid", "Không hợp lệ"],
        "无效": ["Invalid", "Không hợp lệ"],
        "待重试": ["Retry needed", "Cần thử lại"],
        "点击邮箱地址复制": ["Click an address to copy it", "Nhấp địa chỉ để sao chép"],
        "查看详情": ["View details", "Xem chi tiết"],
        "收起详情": ["Hide details", "Thu gọn chi tiết"],
        "关闭测试结果": ["Dismiss test result", "Đóng kết quả kiểm tra"],
        "封禁或凭据失效的邮箱。可编辑凭据后重试，或勾选后批量删除。": ["Blocked accounts or invalid credentials. Update credentials and retry, or select mailboxes to delete.", "Tài khoản bị khóa hoặc thông tin xác thực không hợp lệ. Cập nhật rồi thử lại, hoặc chọn hộp thư để xóa."],
        "网络或检测异常，尚不能判断邮箱无效。可以批量重试。": ["Network or test errors do not establish that a mailbox is invalid. Retry these mailboxes in bulk.", "Lỗi mạng hoặc kiểm tra chưa xác định hộp thư không hợp lệ. Có thể thử lại hàng loạt."],
        "这些邮箱尚未测试，可勾选测试或测试全部筛选结果。": ["These mailboxes have not been tested. Test selected mailboxes or all filtered results.", "Các hộp thư này chưa được kiểm tra. Kiểm tra mục đã chọn hoặc tất cả kết quả đã lọc."],
        "没有符合条件的邮箱": ["No matching mailboxes", "Không có hộp thư phù hợp"],
        "试试其他关键词、切换分组，或添加一个邮箱。": ["Try another search, change groups, or add a mailbox.", "Thử tìm kiếm khác, đổi nhóm hoặc thêm hộp thư."],
        "上一邮箱": ["Previous mailbox", "Hộp thư trước"],
        "下一邮箱": ["Next mailbox", "Hộp thư tiếp theo"],
        "邮箱批量管理": ["Bulk mailbox management", "Quản lý hộp thư hàng loạt"],
        "测试筛选结果": ["Test filtered mailboxes", "Kiểm tra hộp thư đã lọc"],
        "筛选无效": ["Filter invalid mailboxes", "Lọc hộp thư không hợp lệ"],
        "全选筛选结果": ["Select all filtered mailboxes", "Chọn tất cả hộp thư đã lọc"],
        "测试选中邮箱": ["Test selected mailboxes", "Kiểm tra hộp thư đã chọn"],
        "批量测试": ["Batch test", "Kiểm tra hàng loạt"],
        "批量测试结果": ["Batch test results", "Kết quả kiểm tra hàng loạt"],
        "测试进度": ["Test progress", "Tiến độ kiểm tra"],
        "失败邮箱日志": ["Failed mailbox logs", "Nhật ký hộp thư thất bại"],
        "仅显示本次测试失败的邮箱": ["Only failures from this test run", "Chỉ hiển thị lỗi trong lần kiểm tra này"],
        "测试进行中，失败日志将实时显示在这里。": ["Testing in progress. Failed mailbox logs will appear here.", "Đang kiểm tra. Nhật ký lỗi sẽ hiển thị tại đây."],
        "已完成的测试中暂无失败记录。": ["No failures in the completed tests.", "Không có lỗi trong các kiểm tra đã hoàn tất."],
        "本次测试全部通过，无失败记录。": ["All tests passed. No failures recorded.", "Tất cả kiểm tra đều thành công. Không có lỗi."],
        "未测试": ["Not tested", "Chưa kiểm tra"],
        "无效邮箱（封禁 / 凭据失效）": ["Invalid (blocked / expired credentials)", "Không hợp lệ (bị khóa / thông tin xác thực hết hạn)"],
        "无效邮箱包括封禁、凭据失效；网络异常和检测异常请重试。批量操作覆盖当前搜索、分组、操作人及状态筛选下的所有页。": ["Invalid includes blocked accounts and invalid credentials. Retry network and test errors. Bulk actions cover every page matching the current search, group, operator and status filters.", "Không hợp lệ gồm tài khoản bị khóa và thông tin xác thực hết hạn. Hãy thử lại lỗi mạng và lỗi kiểm tra. Thao tác hàng loạt áp dụng cho mọi trang khớp bộ lọc tìm kiếm, nhóm, người thao tác và trạng thái."],
        "停止测试": ["Stop testing", "Dừng kiểm tra"],
        "批量测试中": ["Testing mailboxes", "Đang kiểm tra hàng loạt"],
        "批量测试完成": ["Batch test complete", "Đã kiểm tra xong"],
        "批量测试已停止": ["Batch test stopped", "Đã dừng kiểm tra"],
        "正在停止（等待进行中的测试完成）": ["Stopping (waiting for active tests)", "Đang dừng (chờ kiểm tra đang chạy hoàn tất)"],
        "请选择要测试的邮箱": ["Select mailboxes to test", "Chọn hộp thư để kiểm tra"],
        "已有批量测试正在运行，新导入邮箱可稍后筛选未检测并测试": ["A batch test is running. Filter untested mailboxes later to test newly imported ones.", "Đang kiểm tra hàng loạt. Sau đó lọc hộp thư chưa kiểm tra để kiểm tra hộp thư mới nhập."],
        "请先停止批量测试，等待进行中的测试完成后再删除": ["Stop the batch test and wait for active tests before deleting.", "Dừng kiểm tra hàng loạt và chờ kiểm tra đang chạy hoàn tất trước khi xóa."],
        "删除时间": ["Deleted at", "Thời gian xóa"],
        "删除原因": ["Deletion reason", "Lý do xóa"],
        "过期原因": ["Expiry reason", "Lý do hết hạn"],
        "清空回收站": ["Empty recycle bin", "Dọn thùng rác"],
        "列表字段": ["List fields", "Các trường trong danh sách"],
        "搜索卡密...": ["Search keys...", "Tìm mã..."],
        "设置关键词后只收取标题包含关键词的邮件，多个关键词用逗号分隔": ["Fetch only messages whose subjects contain these keywords. Separate keywords with commas.", "Chỉ lấy thư có tiêu đề chứa từ khóa. Phân tách các từ khóa bằng dấu phẩy."],
        "支持格式：1、7、30、100 或 1天、7天、30天 或具体日期时间": ["Enter days: 1, 7, 30, 100; 1天, 7天, 30天; or a date and time", "Nhập số ngày: 1, 7, 30, 100; 1天, 7天, 30天; hoặc ngày giờ"],
        "卡密用途说明": ["Describe this key’s purpose", "Mô tả mục đích sử dụng mã"],
        "批量卡密用途说明": ["Describe the purpose of these keys", "Mô tả mục đích của các mã"],
        "点击选择按钮选择一个或多个邮箱": ["Use Select to choose one or more mailboxes", "Nhấn Chọn để chọn một hoặc nhiều hộp thư"],
        "搜索邮箱地址...": ["Search email addresses...", "Tìm địa chỉ email..."],
        "卡密被使用后，记录会显示在这里": ["Usage records will appear here when a key is used", "Lịch sử sẽ xuất hiện khi mã được sử dụng"],
        "字段说明": ["Field descriptions", "Mô tả trường"],
        "定期清理": ["Scheduled cleanup", "Dọn dẹp định kỳ"],
        "日志保留天数": ["Log retention days", "Số ngày lưu nhật ký"],
        "成功": ["Success", "Thành công"],
        "失败": ["Failed", "Thất bại"],
        "间隔(秒)": ["Interval (seconds)", "Khoảng cách (giây)"],
        "日志保留(天)": ["Retention (days)", "Lưu nhật ký (ngày)"],
        "退避中": ["In backoff", "Đang tạm ngưng thử lại"],
        "个 ▾": ["accounts ▾", "tài khoản ▾"],
        "未启动": ["Not started", "Chưa khởi động"],
        "下次轮询": ["Next poll", "Lần lấy thư tiếp theo"],
        "邮件自动轮询尚未启动": ["Automatic mail polling has not started", "Chưa khởi động lấy thư tự động"],
        "收件日志 · 轮询控制": ["Mail logs · Polling controls", "Nhật ký thư · Điều khiển lấy thư"],
        "日志来源": ["Log sources", "Nguồn nhật ký"],
        "轮询控制面板": ["Polling controls", "Điều khiển lấy thư"],
        "轮询机制": ["How polling works", "Cách lấy thư định kỳ hoạt động"],
        "按收件状态筛选：成功/失败/已处理": ["Filter mail status: received / failed / processed", "Lọc trạng thái: đã nhận / thất bại / đã xử lý"],
        "关闭后自动轮询暂停，约30秒内生效，无需重启": ["Turning this off pauses polling within about 30 seconds, without restarting", "Tắt để dừng lấy thư trong khoảng 30 giây, không cần khởi động lại"],
        "账号设置": ["Account settings", "Cài đặt tài khoản"],
        "管理员管理": ["Manage administrators", "Quản lý quản trị viên"],
        "系统标题": ["System title", "Tiêu đề hệ thống"],
        "页面标题": ["Page titles", "Tiêu đề trang"],
        "管理员账号设置": ["Admin account settings", "Cài đặt tài khoản quản trị"],
        "管理员用户名": ["Admin username", "Tên đăng nhập quản trị"],
        "管理员密码": ["Admin password", "Mật khẩu quản trị"],
        "确认密码": ["Confirm password", "Xác nhận mật khẩu"],
        "更新管理员账号": ["Update admin account", "Cập nhật tài khoản quản trị"],
        "后台管理员管理": ["Manage admin accounts", "Quản lý tài khoản quản trị"],
        "创建时间": ["Created at", "Thời gian tạo"],
        "当前登录": ["Signed in", "Đang đăng nhập"],
        "当前账号": ["Current account", "Tài khoản hiện tại"],
        "重置账号": ["Reset account", "Đặt lại tài khoản"],
        "新密码": ["New password", "Mật khẩu mới"],
        "确认新密码": ["Confirm new password", "Xác nhận mật khẩu mới"],
        "保存新密码": ["Save new password", "Lưu mật khẩu mới"],
        "新管理员用户名": ["New admin username", "Tên đăng nhập quản trị mới"],
        "新管理员密码": ["New admin password", "Mật khẩu quản trị mới"],
        "确认新管理员密码": ["Confirm new admin password", "Xác nhận mật khẩu quản trị mới"],
        "保存后只存储安全哈希，不会回显明文；请以右侧状态为准。": ["Only a secure hash is stored after saving. The plain text will not be shown; check the status on the right.", "Sau khi lưu chỉ giữ mã băm an toàn, không hiển thị văn bản gốc. Xem trạng thái bên phải."],
        "当前状态": ["Current status", "Trạng thái hiện tại"],
        "设置万能秘钥": ["Set master key", "Đặt khóa chính"],
        "系统名称/标题": ["System name / title", "Tên / tiêu đề hệ thống"],
        "显示在后端管理页面标题中的系统名称，修改后即时生效": ["System name shown in admin page titles; changes apply immediately", "Tên hệ thống trong tiêu đề trang quản trị; thay đổi có hiệu lực ngay"],
        "更新系统标题": ["Update system title", "Cập nhật tiêu đề hệ thống"],
        "API取件页面标题": ["API mail page title", "Tiêu đề trang lấy thư API"],
        "显示在API取件页面的标题": ["Title shown on the API mail page", "Tiêu đề hiển thị trên trang lấy thư API"],
        "前端取件页面标题": ["Public mail page title", "Tiêu đề trang lấy thư công khai"],
        "显示在前端取件页面的标题": ["Title shown on the public mail page", "Tiêu đề hiển thị trên trang lấy thư công khai"],
        "管理员登录页面标题": ["Admin login page title", "Tiêu đề trang đăng nhập quản trị"],
        "显示在管理员登录页面的标题": ["Title shown on the admin login page", "Tiêu đề hiển thị trên trang đăng nhập quản trị"],
        "更新页面标题": ["Update page titles", "Cập nhật tiêu đề trang"],
        "系统名称": ["System name", "Tên hệ thống"],
        "系统版本": ["System version", "Phiên bản hệ thống"],
        "数据库类型": ["Database type", "Loại cơ sở dữ liệu"],
        "设置项": ["Settings", "Cài đặt"],
        "系统设置栏目": ["System settings sections", "Các mục cài đặt hệ thống"],
        "输入新的管理员用户名": ["Enter the new admin username", "Nhập tên đăng nhập quản trị mới"],
        "输入新的管理员密码": ["Enter the new admin password", "Nhập mật khẩu quản trị mới"],
        "再次输入密码确认": ["Enter the password again", "Nhập lại mật khẩu"],
        "至少4位": ["At least 4 characters", "Ít nhất 4 ký tự"],
        "输入新管理员用户名": ["Enter a new admin username", "Nhập tên đăng nhập quản trị mới"],
        "至少6位，设置后可免卡密取件": ["At least 6 characters; fetch mail without a card key after setup", "Ít nhất 6 ký tự; sau khi đặt có thể lấy thư không cần mã"],
        "显示或隐藏万能秘钥": ["Show or hide master key", "Hiện hoặc ẩn khóa chính"],
        "📖 帮助中心": ["📖 Help Center", "📖 Trung tâm trợ giúp"],
        "这里汇总了各功能模块的使用说明、字段释义与常见问题。每个后台页面右上角也有「使用说明」按钮可随时查看。": ["Find module guides, field descriptions and frequently asked questions here. The User guide button on each admin page also opens contextual help.", "Xem hướng dẫn chức năng, mô tả trường và câu hỏi thường gặp tại đây. Nút Hướng dẫn sử dụng trên mỗi trang quản trị cũng mở trợ giúp tương ứng."],
        "定时触发": ["Scheduled trigger", "Kích hoạt theo lịch"],
        "遍历启用邮箱": ["Visit enabled mailboxes", "Duyệt hộp thư đang bật"],
        "跳过退避中的邮箱": ["Skip mailboxes in backoff", "Bỏ qua hộp thư đang tạm ngưng"],
        "IMAP 收取最新邮件": ["Fetch latest mail via IMAP", "Lấy thư mới nhất qua IMAP"],
        "去重写入日志": ["Deduplicate and save logs", "Loại trùng và lưu nhật ký"],
        "失败则退避/成功则恢复": ["Back off on failure; resume on success", "Tạm ngưng khi lỗi; tiếp tục khi thành công"],
        '帮助中心': ['Help Center', 'Trung tâm trợ giúp'],
        '后台管理': ['Admin Console', 'Bảng quản trị'],
        '后台页面': ['Admin Page', 'Trang quản trị'],
        '退出': ['Log Out', 'Đăng xuất'],
        '用户名或密码错误': ['Incorrect username or password', 'Tên đăng nhập hoặc mật khẩu không đúng'],
        '页面加载中': ['Loading page', 'Đang tải trang'],
        '页面加载时间较长，请重试': ['This page is taking longer to load. Please retry.', 'Trang tải lâu hơn dự kiến. Vui lòng thử lại.'],
        '重试': ['Retry', 'Thử lại'],
        '关闭菜单': ['Close menu', 'Đóng menu'],
        '邮件文件夹': ['Mail folders', 'Thư mục thư'],
        '邮箱切换': ['Switch mailbox', 'Chuyển hộp thư'],
        '正在获取邮件，请稍候': ['Fetching mail, please wait', 'Đang lấy thư, vui lòng chờ'],
        '全部状态': ['All statuses', 'Tất cả trạng thái'],
        '账号状态': ['Account status', 'Trạng thái tài khoản'],
        '邮箱详情': ['Mailbox details', 'Chi tiết hộp thư'],
        '账号资料': ['Account data', 'Dữ liệu tài khoản'],
        '账号搜索': ['Account search', 'Tìm tài khoản'],
        '搜索邮箱或登录用户名': ['Search email or login username', 'Tìm email hoặc tên đăng nhập'],
        '创建人': ['Created by', 'Người tạo'],
        '全部创建人': ['All creators', 'Tất cả người tạo'],
        '分类（邮箱分组）': ['Category (mailbox group)', 'Danh mục (nhóm hộp thư)'],
        '全部分类': ['All categories', 'Tất cả danh mục'],
        '分类': ['Category', 'Danh mục'],
        '认证方式': ['Authentication', 'Xác thực'],
        '全部认证方式': ['All authentication types', 'Tất cả loại xác thực'],
        '密码登录': ['Password login', 'Đăng nhập bằng mật khẩu'],
        '开始日期': ['Start date', 'Ngày bắt đầu'],
        '结束日期': ['End date', 'Ngày kết thúc'],
        '开始日期不能晚于结束日期': ['Start date must not be after end date', 'Ngày bắt đầu không được sau ngày kết thúc'],
        '筛选参数无效，请检查日期范围和分类': ['Invalid filters. Check the date range and category.', 'Bộ lọc không hợp lệ. Kiểm tra khoảng ngày và danh mục.'],
        '请选择 1 至 5000 个账号': ['Select between 1 and 5,000 accounts', 'Chọn từ 1 đến 5.000 tài khoản'],
        '全选本页': ['Select this page', 'Chọn trang này'],
        '筛选结果': ['Results', 'Kết quả'],
        '复制所选': ['Copy selected', 'Sao chép đã chọn'],
        '清空选择': ['Clear selection', 'Bỏ chọn tất cả'],
        '显示凭据': ['Show credentials', 'Hiển thị thông tin xác thực'],
        '复制格式': ['Copy format', 'Định dạng sao chép'],
        '跨页保留勾选；应用筛选后清空。复制始终使用完整原值，每个账号一行。': ['Selections persist across pages and clear when filters are applied. Copies contain complete original values, one account per line.', 'Lựa chọn được giữ qua các trang và xóa khi áp dụng bộ lọc. Sao chép giá trị gốc đầy đủ, mỗi dòng một tài khoản.'],
        '没有符合条件的账号': ['No matching accounts', 'Không có tài khoản phù hợp'],
        '筛选': ['Filter', 'Lọc'],
        '会话已过期，请重新登录': ['Session expired. Please log in again.', 'Phiên đã hết hạn. Vui lòng đăng nhập lại.'],
        '未获上级授权使用此功能': ['You have not been granted access to this feature', 'Bạn chưa được cấp quyền dùng tính năng này'],
        '邮箱不存在或无权访问': ['Mailbox not found or access denied', 'Không tìm thấy hộp thư hoặc không có quyền truy cập'],
        '正在加载邮箱详情…': ['Loading mailbox details…', 'Đang tải chi tiết hộp thư…'],
        '以下为当前保存的邮箱配置；密码和令牌可点击显示或复制。': ['These are the currently saved mailbox settings. Reveal or copy passwords and tokens using the buttons.', 'Đây là cấu hình hộp thư hiện đã lưu. Dùng các nút để hiển thị hoặc sao chép mật khẩu và mã thông báo.'],
        '基本信息': ['Basic information', 'Thông tin cơ bản'],
        '登录用户名': ['Login username', 'Tên đăng nhập'],
        '邮箱 ID': ['Mailbox ID', 'ID hộp thư'],
        '认证与 OAuth': ['Authentication & OAuth', 'Xác thực & OAuth'],
        '认证方式 (auth_type)': ['Authentication type (auth_type)', 'Loại xác thực (auth_type)'],
        '密码 / 授权码': ['Password / app password', 'Mật khẩu / mã ủy quyền'],
        '收件配置': ['Incoming mail settings', 'Cấu hình nhận thư'],
        '发件配置': ['Outgoing mail settings', 'Cấu hình gửi thư'],
        '服务器地址': ['Server address', 'Địa chỉ máy chủ'],
        '协议': ['Protocol', 'Giao thức'],
        '状态与时间': ['Status & timestamps', 'Trạng thái & thời gian'],
        '启用状态': ['Enabled status', 'Trạng thái bật'],
        '最后检测时间': ['Last tested', 'Lần kiểm tra cuối'],
        '检测结果': ['Test result', 'Kết quả kiểm tra'],
        '未设置': ['Not set', 'Chưa thiết lập'],
        '已开启': ['Enabled', 'Đã bật'],
        '已关闭': ['Disabled', 'Đã tắt'],
        '显示': ['Reveal', 'Hiển thị'],
        '隐藏': ['Hide', 'Ẩn'],
        '未检测': ['Not tested', 'Chưa kiểm tra'],
        '尚未检测': ['Not tested yet', 'Chưa được kiểm tra'],
        '正常': ['Healthy', 'Bình thường'],
        '已删除': ['Deleted', 'Đã xóa'],
        '封禁': ['Blocked', 'Bị khóa'],
        '凭据失效': ['Invalid credentials', 'Thông tin xác thực không hợp lệ'],
        '网络异常': ['Network error', 'Lỗi mạng'],
        '检测异常': ['Test error', 'Lỗi kiểm tra'],
        '当前为保存前的测试结果。': ['This test was run before saving.', 'Đây là kết quả kiểm tra trước khi lưu.'],
        '测试请求未返回账号状态': ['The test did not return an account status', 'Kiểm tra không trả về trạng thái tài khoản'],
        '未获得有效检测结果，已保存的账号状态未更改。': ['No valid test result was received. The saved account status is unchanged.', 'Không nhận được kết quả hợp lệ. Trạng thái tài khoản đã lưu không thay đổi.'],
        '最后修改时间': ['Last modified', 'Sửa đổi lần cuối'],
        '操作人': ['Operator', 'Người thao tác'],
        '（无主题）': ['(No subject)', '(Không có tiêu đề)'],
        '时间:': ['Time:', 'Thời gian:'],
        '发件人:': ['From:', 'Người gửi:'],
        '收件人:': ['To:', 'Người nhận:']
    };
    Object.entries(sharedMessages).forEach(([key, values]) => {
        dictionary.en[key] = values[0];
        dictionary.vi[key] = values[1];
    });

    // Filipino translations are shared by the React shell and legacy pages.
    dictionary.fil = {
        '自定义': 'Pasadya',
        '自定义每页条数': 'Pasadyang bilang bawat pahina',
        '请输入 1–10000 之间的整数': 'Maglagay ng buong bilang mula 1 hanggang 10000',
        '应用': 'Ilapat',
        '导入格式说明': 'Mga format ng pag-import',
        '每行一个邮箱，也支持 JSON 数组、CSV/TSV 表头和分行字段。': 'Isang mailbox bawat linya. Sinusuportahan din ang JSON array, CSV/TSV header at mga field sa magkakahiwalay na linya.',
        '支持中英文逗号、分号、竖线、冒号、Tab、空格、JSON、key=value': 'Sinusuportahan ang kuwit, semicolon, pipe, colon, tab, espasyo, JSON at key=value.',
        "你的云端邮局": "ANG IYONG MAIL SA CLOUD",
        "每一封来信，": "Bawat mensahe, ",
        "都值得期待。": "may dalang pag-asa.",
        "让光影流转，让消息抵达。": "Hayaan ang liwanag na gumalaw at ang mga mensahe na dumating.",
        "场景切换": "Pumili ng tanawin",
        "白天": "Araw",
        "黑夜": "Gabi",
        "雨夜": "Maulang gabi",
        "语言": "Wika",
        "颜色主题": "Tema ng kulay",
        "暖陶橙": "Mainit na luwad",
        "海洋蓝": "Asul na karagatan",
        "翡翠绿": "Berdeng esmeralda",
        "紫罗兰": "Lila",
        "玫瑰红": "Pulang rosas",
        "邮件查看系统": "Sistema ng pagtingin ng mail",
        "邮件管理系统": "Sistema ng pamamahala ng mail",
        "邮件查看系统后台管理": "Admin console ng mail",
        "管理员登录": "Pag-login ng admin",
        "用户名": "Username",
        "密码": "Password",
        "登录": "Mag-login",
        "退出登录": "Mag-logout",
        "欢迎": "Maligayang pagdating",
        "首页": "Home",
        "邮箱管理": "Mga mailbox",
        "代理池": "Mga proxy",
        "卡密管理": "Mga access key",
        "卡密日志": "Mga log ng key",
        "收件日志": "Mga log ng mail",
        "系统设置": "Mga setting ng system",
        "展开侧边栏": "Palawakin ang sidebar",
        "收起菜单": "Paliitin ang menu",
        "展开菜单": "Palawakin ang menu",
        "展开": "Palawakin",
        "收起": "Paliitin",
        "切换主题": "Palitan ang tema",
        "切换到明亮模式": "Lumipat sa maliwanag na mode",
        "切换到暗黑模式": "Lumipat sa madilim na mode",
        "显示密码": "Ipakita ang password",
        "隐藏密码": "Itago ang password",
        "显示/隐藏密码": "Ipakita/itago ang password",
        "添加邮箱": "Magdagdag ng mailbox",
        "批量添加邮箱": "Magdagdag ng mga mailbox nang maramihan",
        "添加服务器地址": "Magdagdag ng address ng server",
        "隐藏分组": "Itago ang mga grupo",
        "显示分组": "Ipakita ang mga grupo",
        "分组管理": "Pamamahala ng mga grupo",
        "所有分组": "Lahat ng grupo",
        "未分组": "Walang grupo",
        "暂无自定义分组": "Walang custom na grupo",
        "显示列": "Mga column",
        "复制已选": "Kopyahin ang napili",
        "搜索": "Maghanap",
        "清除": "I-clear",
        "搜索邮箱地址或服务器...": "Hanapin ang mailbox o server...",
        "序号ID": "ID",
        "序号": "Blg.",
        "分组": "Grupo",
        "邮箱地址": "Email address",
        "服务器（收/发）": "Server (IMAP/SMTP)",
        "添加时间": "Petsa ng pagdagdag",
        "备注": "Mga tala",
        "操作": "Mga aksyon",
        "编辑": "I-edit",
        "收件": "Tumanggap",
        "发件": "Magpadala",
        "测试": "Subukan",
        "删除": "Tanggalin",
        "保存": "I-save",
        "取消": "Kanselahin",
        "确定": "OK",
        "确认": "Kumpirmahin",
        "关闭": "Isara",
        "新增": "Magdagdag",
        "批量删除": "Tanggalin nang maramihan",
        "全选": "Piliin lahat",
        "导入": "Mag-import",
        "导出": "Mag-export",
        "刷新": "I-refresh",
        "加载中...": "Naglo-load...",
        "正在加载...": "Naglo-load...",
        "暂无数据": "Walang data",
        "暂无记录": "Walang rekord",
        "暂无邮箱": "Walang mailbox",
        "暂无卡密日志": "Walang log ng key",
        "网络错误，请稍后重试": "Error sa network. Subukan muli mamaya",
        "复制成功": "Nakopya na",
        "复制失败，请手动复制": "Hindi makopya. Kopyahin nang manu-mano",
        "邮箱地址已复制": "Nakopya na ang email address",
        "已复制邮箱地址": "Nakopya na ang email address",
        "复制邮箱": "Kopyahin ang mailbox",
        "请选择要复制的邮箱": "Piliin ang mga mailbox na kokopyahin",
        "系统概览": "Pangkalahatang-ideya ng system",
        "快速操作": "Mga mabilisang aksyon",
        "系统信息": "Impormasyon ng system",
        "页面标题设置": "Mga setting ng pamagat ng pahina",
        "系统标题设置": "Mga setting ng pamagat ng system",
        "管理员账号": "Account ng admin",
        "管理员列表": "Listahan ng mga admin",
        "新增管理员": "Magdagdag ng admin",
        "重置密码": "I-reset ang password",
        "当前管理员": "Kasalukuyang admin",
        "邮箱范围权限": "Access sa mailbox",
        "管理员邮箱可见范围": "Access ng admin sa mailbox",
        "受限管理员": "Admin na may limitasyon",
        "目标管理员": "Target na admin",
        "搜索邮箱": "Hanapin ang mga mailbox",
        "搜索邮箱地址、操作人或备注...": "Hanapin ang email, operator, o mga tala...",
        "正在加载邮箱范围...": "Nilo-load ang access sa mailbox...",
        "保存可见范围": "I-save ang access",
        "没有匹配的邮箱": "Walang tumugmang mailbox",
        "本人添加 · 始终可见": "Idinagdag ng admin na ito · Laging nakikita",
        "历史数据": "Lumang data",
        "受限管理员默认只能看到自己添加的邮箱。这里勾选的邮箱会作为额外授权；未勾选的其他管理员邮箱及其分组不会出现在邮箱管理、搜索、卡密绑定和收件日志中。": "Makikita lang ng mga admin na may limitasyon ang sarili nilang mga mailbox. Ang mga naka-check ay dagdag na access; ang mga hindi napiling mailbox at grupo ng ibang admin ay hindi makikita sa pamamahala, paghahanap, pag-uugnay ng key, at mga log ng mail.",
        "可为任意管理员单独启用邮箱范围限制。启用后，该管理员只能看到自己添加的邮箱，以及这里授权的邮箱分组和单个邮箱；分组中新加入的邮箱会自动继承权限。": "Maaaring limitahan ang access ng bawat admin sa mga mailbox. Kapag naka-enable, makikita lang nila ang sarili nilang mailbox at ang mga pinahintulutang grupo at mailbox. Awtomatikong magkakaroon ng access sa mga bagong mailbox sa pinahintulutang grupo.",
        "限制该管理员的邮箱范围": "Limitahan ang access ng admin na ito sa mailbox",
        "关闭时可查看全部邮箱；开启后按下方授权范围显示。": "Kapag naka-off, makikita ang lahat ng mailbox. Kapag naka-on, susundin ang mga pahintulot sa ibaba.",
        "已启用限制": "Naka-enable ang limitasyon",
        "未启用限制": "Walang limitasyon",
        "按邮箱分组授权": "Magbigay ng access ayon sa grupo",
        "授权整个分组，后续加入的邮箱自动可见": "Pahintulutan ang buong grupo; awtomatikong makikita ang mga bagong mailbox",
        "按单个邮箱授权": "Pahintulutan ang mga indibidwal na mailbox",
        "可与分组权限叠加": "Maaaring isama sa access ng grupo",
        "正在加载邮箱分组...": "Nilo-load ang mga grupo ng mailbox...",
        "暂无可授权分组": "Walang grupong maaaring pahintulutan",
        "当前未限制，可查看全部邮箱": "Walang limitasyon; nakikita ang lahat ng mailbox",
        "请选择受限管理员": "Pumili ng admin na may limitasyon",
        "获取邮箱范围失败": "Hindi ma-load ang access sa mailbox",
        "保存邮箱范围失败": "Hindi ma-save ang access sa mailbox",
        "邮箱可见范围已保存": "Na-save na ang access sa mailbox",
        "管理员万能秘钥": "Master key ng admin",
        "万能秘钥": "Master key",
        "保存设置": "I-save ang mga setting",
        "代理池管理": "Mga proxy",
        "HTTP代理": "HTTP proxy",
        "SOCKS5代理": "SOCKS5 proxy",
        "添加代理": "Magdagdag ng proxy",
        "批量添加代理": "Magdagdag ng mga proxy nang maramihan",
        "代理地址": "Address ng proxy",
        "端口": "Port",
        "状态": "Katayuan",
        "启用": "I-enable",
        "禁用": "I-disable",
        "卡密": "Access key",
        "生成卡密": "Gumawa ng key",
        "批量生成": "Gumawa nang maramihan",
        "使用次数": "Bilang ng paggamit",
        "剩余次数": "Natitirang paggamit",
        "过期时间": "Petsa ng pag-expire",
        "绑定邮箱": "Naka-link na email",
        "回收站": "Recycle bin",
        "清空日志": "Burahin ang mga log",
        "保存定期清理": "I-save ang paglilinis",
        "保留天数(0关闭)": "Mga araw ng pagpapanatili (0 para i-off)",
        "卡密使用日志": "Mga log ng paggamit ng key",
        "邮件标题": "Paksa ng mail",
        "使用者IP": "IP ng gumagamit",
        "使用时间（北京时间）": "Oras ng paggamit (oras sa Beijing)",
        "卡密绑定邮箱": "Naka-link na email",
        "邮件查看": "Pagtingin ng mail",
        "输入后台邮箱地址，即刻查看最新邮件": "Ilagay ang naka-configure na mailbox upang makita ang pinakabagong mga mensahe",
        "卡密 / 管理员万能秘钥": "Access key / Master key ng admin",
        "请输入卡密或管理员万能秘钥": "Ilagay ang access key o master key ng admin",
        "设置后的万能秘钥可免卡密取件": "Maaaring kumuha ng mail gamit ang master key nang walang access key",
        "邮箱查询": "Paghahanap ng mailbox",
        "查询邮箱": "Mga mailbox na hinanap",
        "请输入邮箱地址 (例: user@example.com)": "Ilagay ang email address (hal. user@example.com)",
        "请输入邮局后台已添加的邮箱地址，支持多个自动识别：user@example.com\ntest@example.com, demo@example.com": "Ilagay ang mga email address na idinagdag ng admin. Awtomatikong makikilala ang maraming address:\nuser@example.com\ntest@example.com, demo@example.com",
        "请输入邮箱地址，支持多个邮箱自动识别：user@example.com\ntest@example.com, demo@example.com": "Ilagay ang mga email address. Awtomatikong makikilala ang maraming address:\nuser@example.com\ntest@example.com, demo@example.com",
        "每个邮箱收取": "Bawat mailbox",
        "支持换行、逗号、空格、竖线等格式，会自动识别邮箱地址；默认每个邮箱查询 10 封。": "Tumatanggap ng bagong linya, kuwit, espasyo, at patayong guhit. Awtomatikong kinikilala ang mga email address. Karaniwang 10 mail bawat mailbox.",
        "收取封数": "Bilang ng mail",
        "获取邮件": "Kunin ang mail",
        "获取中...": "Kinukuha...",
        "邮箱文件夹": "Mga folder ng mail",
        "展开邮箱文件夹": "Palawakin ang mga folder ng mail",
        "折叠邮箱文件夹": "Paliitin ang mga folder ng mail",
        "收件箱": "Inbox",
        "垃圾箱": "Basurahan",
        "正在获取邮件，请稍候...": "Kinukuha ang mail. Mangyaring maghintay...",
        "邮箱": "Mailbox",
        "标题": "Paksa",
        "验证码": "Verification code",
        "发件人": "Mula kay",
        "收件人": "Para kay",
        "时间": "Oras",
        "暂无邮件": "Walang mail",
        "返回邮件列表": "Bumalik sa listahan ng mail",
        "发件人:": "Mula kay:",
        "收件人:": "Para kay:",
        "时间:": "Oras:",
        "图片内容": "Mga larawan",
        "附件": "Mga attachment",
        "下载": "I-download",
        "请输入邮箱地址": "Ilagay ang email address",
        "单次最多支持 50 个邮箱，请分批查询": "Hanggang 50 mailbox bawat paghahanap. Hatiin sa mga batch.",
        "已检测到管理员登录状态，免卡密访问": "Naka-login ang admin. Hindi kailangan ng access key.",
        "您尚未登录管理员账户，请使用卡密或万能秘钥访问": "Hindi ka naka-login bilang admin. Gumamit ng access key o master key upang ma-access ang mail.",
        "未获取到邮件": "Walang nakuhang mail",
        "请求失败": "Nabigo ang request",
        "请输入有效的邮箱地址": "Ilagay ang wastong email address",
        "邮箱中暂无邮件": "Walang mail sa mailbox na ito",
        "获取邮件失败": "Hindi makuha ang mail",
        "网络请求失败，请检查网络连接": "Nabigo ang network request. Suriin ang iyong koneksyon",
        "邮件获取成功": "Matagumpay na nakuha ang mail",
        "附件下载已开始": "Nagsimula na ang pag-download ng attachment",
        "附件下载失败": "Hindi ma-download ang attachment",
        "未知": "Hindi alam",
        "无主题": "Walang paksa",
        "（无主题）": "(Walang paksa)",
        "(无主题)": "(Walang paksa)",
        "(邮件内容为空)": "(Walang laman ang mail)",
        "（无正文）": "(Walang nilalaman)",
        "批量复制": "Kopyahin nang maramihan",
        "批量分组": "Igrupo nang maramihan",
        "管理员：": "Admin:",
        "当前分组：": "Kasalukuyang grupo:",
        "邮箱：": "Mga mailbox:",
        "已选：": "Napili:",
        "已选": "Napili",
        "个邮箱": "mailbox",
        "取消选择": "Alisin ang pagpili",
        "选择": "Pumili",
        "上级分组": "Magulang na grupo",
        "分组名称": "Pangalan ng grupo",
        "输入分组名称": "Ilagay ang pangalan ng grupo",
        "添加分组": "Magdagdag ng grupo",
        "添加下级分组": "Magdagdag ng subgrupo",
        "编辑分组": "I-edit ang grupo",
        "已选择邮箱": "Mga napiling mailbox",
        "目标分组": "Target na grupo",
        "应用分组": "Ilapat ang grupo",
        "发送邮件": "Magpadala ng mail",
        "昵称": "Palayaw",
        "收件人看到的发件人昵称（可选）": "Palayaw ng nagpadala na makikita ng tatanggap (opsyonal)",
        "主题": "Paksa",
        "正文": "Nilalaman",
        "邮件主题": "Paksa ng mail",
        "邮件正文": "Nilalaman ng mail",
        "当前邮箱": "Kasalukuyang mailbox",
        "收取": "Kunin",
        "封": "mensahe",
        "收取邮件": "Kunin ang mail",
        "收件失败": "Hindi makuha ang mail",
        "返回列表": "Bumalik sa listahan",
        "图片": "Mga larawan",
        "邮箱账号": "Account ng mailbox",
        "邮箱密码": "Password ng mailbox",
        "邮箱密码或授权码": "Password ng mailbox o app password",
        "选择服务器": "Pumili ng server",
        "选择已有服务器或手动输入": "Pumili ng server o ilagay nang manu-mano",
        "收件服务器地址": "Server ng papasok na mail",
        "发件服务器地址": "Server ng papalabas na mail",
        "收件协议": "Protocol ng papasok na mail",
        "发件协议": "Protocol ng papalabas na mail",
        "收件端口": "Port ng papasok na mail",
        "发件端口": "Port ng papalabas na mail",
        "收件启用SSL": "SSL ng papasok na mail",
        "发件启用SSL": "SSL ng papalabas na mail",
        "输入备注信息": "Maglagay ng mga tala",
        "输入操作人": "Ilagay ang operator",
        "自动识别邮箱内容": "Awtomatikong kilalanin ang nilalaman ng mailbox",
        "输入新分组名，回车添加": "Ilagay ang bagong pangalan ng grupo, pindutin ang Enter upang idagdag",
        "可直接新增分组，添加后会自动选中。": "Maaaring magdagdag ng grupo dito; awtomatiko itong mapipili pagkatapos.",
        "批量添加": "Magdagdag nang maramihan",
        "编辑备注": "I-edit ang mga tala",
        "备注内容": "Nilalaman ng tala",
        "服务器地址管理": "Pamamahala ng mga address ng server",
        "服务器名称": "Pangalan ng server",
        "添加服务器": "Magdagdag ng server",
        "更新服务器": "I-update ang server",
        "已添加的服务器": "Mga naka-save na server",
        "批量删除选中": "Tanggalin ang napili",
        "暂无服务器配置": "Walang configuration ng server",
        "收/发信息": "Papasok/Papalabas",
        "检测状态": "Katayuan ng pagsusuri",
        "添加人": "Idinagdag ni",
        "操作人": "Operator",
        "最后修改时间": "Huling binago",
        "未检测": "Hindi pa nasusuri",
        "邮箱正常": "Maayos ang mailbox",
        "邮箱异常": "May error ang mailbox",
        "未指定": "Walang nakatalaga",
        "全部添加人": "Lahat ng nagdagdag",
        "全部操作人": "Lahat ng operator",
        "按检测状态筛选": "Salain ayon sa katayuan ng pagsusuri",
        "按添加人筛选": "Salain ayon sa nagdagdag",
        "按操作人筛选": "Salain ayon sa operator",
        "尚未检测": "Hindi pa nasusuri",
        "收：": "Papasok:",
        "发：": "Papalabas:",
        "更多": "Higit pa",
        "点击复制邮箱": "I-click upang kopyahin ang mailbox",
        "暂无邮箱账号": "Walang account ng mailbox",
        "每页": "Bawat pahina",
        "上一页": "Nakaraan",
        "下一页": "Susunod",
        "加载邮箱列表失败": "Hindi ma-load ang listahan ng mailbox",
        "请填写分组名称": "Ilagay ang pangalan ng grupo",
        "分组添加成功": "Naidagdag na ang grupo",
        "分组添加失败": "Hindi maidagdag ang grupo",
        "分组更新成功": "Na-update na ang grupo",
        "分组更新失败": "Hindi ma-update ang grupo",
        "分组删除成功": "Natanggal na ang grupo",
        "分组删除失败": "Hindi matanggal ang grupo",
        "分组分配失败": "Hindi maitalaga ang grupo",
        "确定要删除该分组及其子分组吗？": "Tanggalin ang grupong ito at ang mga subgrupo nito?",
        "登录状态已失效，请刷新页面后重新登录": "Nag-expire ang login. I-refresh at mag-login muli.",
        "测试中...": "Sinusubukan...",
        "测试失败：Microsoft OAuth 拒绝该账号，账号处于 service abuse mode": "Nabigo ang pagsusuri: tinanggihan ng Microsoft OAuth ang account dahil nasa service abuse mode ito",
        "测试失败：OAuth 令牌获取失败": "Nabigo ang pagsusuri: hindi makuha ang OAuth token",
        "测试失败：邮箱认证失败，请检查密码、授权码或 OAuth 数据": "Nabigo ang pagsusuri: hindi ma-authenticate ang mailbox. Suriin ang password, app password, o OAuth data",
        "Microsoft OAuth 拒绝该账号登录，账号处于 service abuse mode": "Tinanggihan ng Microsoft OAuth ang account dahil nasa service abuse mode ito",
        "OAuth 令牌获取失败": "Hindi makuha ang OAuth token",
        "邮箱认证失败": "Hindi ma-authenticate ang mailbox",
        "SSL 连接失败": "Nabigo ang koneksyon sa SSL",
        "未找到邮箱信息": "Hindi makita ang mailbox",
        "所有邮件已存在，未发现新邮件": "Naka-save na ang lahat ng mail. Walang bagong mail.",
        "邮箱中暂无新邮件": "Walang bagong mail sa mailbox na ito",
        "收件失败，详情已显示在弹窗内": "Hindi makuha ang mail. Nasa dialog ang mga detalye.",
        "网络错误，详情已显示在弹窗内": "Error sa network. Nasa dialog ang mga detalye.",
        "请填写完整的邮箱信息后再测试": "Kumpletuhin ang impormasyon ng mailbox bago subukan",
        "邮箱连接测试成功": "Matagumpay ang pagsusuri sa koneksyon ng mailbox",
        "测试请求失败，请检查服务是否正常运行": "Nabigo ang test request. Suriin kung tumatakbo ang serbisyo.",
        "请填写收件人地址": "Ilagay ang address ng tatanggap",
        "发送成功": "Matagumpay na naipadala",
        "发送失败": "Hindi maipadala",
        "确定要删除这个邮箱账号吗？": "Tanggalin ang account ng mailbox na ito?",
        "邮箱删除成功": "Natanggal na ang mailbox",
        "删除失败": "Hindi matanggal",
        "请填写完整的收/发件服务器信息": "Kumpletuhin ang impormasyon ng server ng papasok at papalabas na mail",
        "保存成功": "Na-save na",
        "保存失败": "Hindi ma-save",
        "请填写所有必需字段": "Punan ang lahat ng kailangang field",
        "批量添加成功": "Matagumpay ang maramihang pagdagdag",
        "批量添加失败": "Nabigo ang maramihang pagdagdag",
        "邮箱地址为空": "Walang laman ang address ng mailbox",
        "选中的邮箱不存在": "Hindi umiiral ang mga napiling mailbox",
        "请选择要分组的邮箱": "Piliin ang mga mailbox na igrugrupo",
        "请选择要删除的邮箱": "Piliin ang mga mailbox na tatanggalin",
        "批量删除成功": "Matagumpay ang maramihang pagtanggal",
        "批量删除失败": "Nabigo ang maramihang pagtanggal",
        "请填写完整的服务器信息": "Kumpletuhin ang impormasyon ng server",
        "服务器保存成功": "Na-save na ang server",
        "服务器保存失败": "Hindi ma-save ang server",
        "确定要删除这个服务器配置吗？": "Tanggalin ang configuration ng server na ito?",
        "服务器删除成功": "Natanggal na ang server",
        "请选择要删除的服务器": "Piliin ang mga server na tatanggalin",
        "获取邮箱信息失败": "Hindi makuha ang impormasyon ng mailbox",
        "邮箱ID缺失": "Walang ID ng mailbox",
        "备注保存成功": "Na-save na ang mga tala",
        "邮件收件日志": "Mga log ng pagtanggap ng mail",
        "日志总数": "Kabuuang mga log",
        "成功收取": "Matagumpay na pagkuha",
        "失败记录": "Mga nabigong rekord",
        "轮询间隔": "Agwat ng polling",
        "关键词：邮箱、主题、发件人、正文": "Mga keyword: mailbox, paksa, nagpadala, nilalaman",
        "全部状态": "Lahat ng katayuan",
        "已处理": "Naproseso na",
        "全部管理员": "Lahat ng admin",
        "查询": "Maghanap",
        "清空": "I-clear",
        "立即查询": "Hanapin ngayon",
        "批量筛选": "Salain nang maramihan",
        "批量邮箱筛选：每行或逗号分隔多个邮箱": "Salain ang mga mailbox: isa bawat linya o pinaghiwalay ng kuwit",
        "批量主题筛选：每行或逗号分隔多个关键词": "Salain ang mga paksa: mga keyword bawat linya o pinaghiwalay ng kuwit",
        "批量发件人筛选：每行或逗号分隔多个发件人": "Salain ang mga nagpadala: isa bawat linya o pinaghiwalay ng kuwit",
        "最近开始": "Huling pagsisimula",
        "最近结束": "Huling pagtatapos",
        "结果": "Resulta",
        "收件日志详情": "Mga detalye ng log ng mail",
        "自动轮询": "Awtomatikong polling",
        "手动轮询": "Manu-manong polling",
        "后台取件": "Pagkuha ng admin",
        "卡密接口": "API ng access key",
        "卡密预览": "Preview ng key",
        "手动": "Manu-mano",
        "管理员": "Admin",
        "主题 / 摘要": "Paksa / Buod",
        "收件时间": "Oras ng pagtanggap",
        "详情": "Mga detalye",
        "最后查询": "Huling paghahanap",
        "暂无收件日志": "Walang log ng mail",
        "日志ID": "ID ng log",
        "收件邮箱": "Mailbox",
        "来源": "Pinagmulan",
        "记录": "Naitala",
        "处理建议": "Mungkahi",
        "错误详情": "Mga detalye ng error",
        "检查邮箱密码/授权码是否正确，确认邮箱已开启 IMAP，并确认账号没有触发安全拦截。": "Suriin ang password/app password ng mailbox, tiyaking naka-enable ang IMAP, at walang pagharang ng seguridad sa account.",
        "检查收件服务器端口和 SSL 开关是否匹配；常见 IMAP SSL 使用 993，STARTTLS 或非 SSL 配置不要使用隐式 SSL。": "Tiyaking tugma ang port ng papasok na server at ang SSL setting. Karaniwang 993 ang IMAP SSL; huwag gumamit ng implicit SSL para sa STARTTLS o non-SSL.",
        "检查服务器地址、端口、网络连通性和代理配置。": "Suriin ang address ng server, port, koneksyon sa network, at mga setting ng proxy.",
        "检查服务器域名是否填写正确，或当前网络是否能解析该域名。": "Suriin kung tama ang domain ng server at kung kaya itong i-resolve ng kasalukuyang network.",
        "根据完整错误检查邮箱账号、授权码、服务器地址、端口、SSL 和代理配置。": "Batay sa buong error, suriin ang account, app password, address ng server, port, SSL, at mga setting ng proxy.",
        "这条是收取失败记录，没有实际邮件正文。请查看下方错误详情。": "Rekord ito ng nabigong pagkuha at walang nilalaman ng mail. Tingnan ang mga detalye ng error sa ibaba.",
        "这条记录没有保存正文。重新收取或轮询成功后，这里会显示实际邮件内容。": "Walang naka-save na nilalaman sa rekord na ito. Makikita rito ang mail pagkatapos ng matagumpay na pagkuha o polling.",
        "登录状态已失效，请重新登录": "Nag-expire ang login. Mag-login muli.",
        "获取收件日志失败": "Hindi ma-load ang mga log ng mail",
        "启动中...": "Nagsisimula...",
        "已开始轮询": "Nagsimula na ang polling",
        "轮询启动失败": "Hindi masimulan ang polling",
        "API取件页面": "Pahina ng pagkuha ng mail sa API",
        "此卡密不存在": "Hindi umiiral ang access key na ito",
        "请检查卡密是否正确，或联系管理员获取有效卡密": "Suriin ang access key o makipag-ugnayan sa admin",
        "复制": "Kopyahin",
        "前台密钥": "Pampublikong access key",
        "前台取件需要密钥": "Kailangan ng key para kumuha ng mail sa pampublikong pahina",
        "开启后，前台显示密钥输入框，验证通过后才能取件；关闭后恢复邮箱直接取件。": "Kapag naka-enable, kailangan ng wastong key sa pampublikong pahina para kumuha ng mail. Kapag naka-disable, sapat na ang email address.",
        "此开关仅 tjt740 本人可见、可修改。": "Si tjt740 lamang ang maaaring makakita at magbago ng setting na ito.",
        "正在读取取件设置…": "Nilo-load ang mga setting ng access sa mail…",
        "已开启：前台取件必须验证密钥": "Naka-enable: kailangan ng wastong key para kumuha ng mail",
        "已关闭：前台可直接用邮箱取件": "Naka-disable: kumuha ng mail gamit ang email address",
        "前台密钥设置已保存": "Na-save na ang mga setting ng pampublikong access key",
        "暂时无法确认取件设置，请刷新页面重试": "Hindi matiyak ang mga setting ng access sa mail. I-refresh ang pahina at subukan muli.",
        "请先设置万能秘钥，再开启前台密钥取件": "Magtakda muna ng master key bago humingi ng key para kumuha ng mail",
        "请选择开启或关闭": "Piliin kung naka-enable o naka-disable",
        "无权修改前台密钥设置": "Wala kang pahintulot na baguhin ang mga setting ng pampublikong access key",
        "取件密钥": "Key para sa access sa mail",
        "请输入取件密钥": "Ilagay ang iyong key para sa access sa mail",
        "验证密钥后获取邮件，密钥仅用于本次页面取件。": "Maglagay ng wastong key upang kumuha ng mail. Sa pahinang ito lamang itatago ang key.",
        "请输入有效密钥后再获取邮件": "Maglagay ng wastong key bago kumuha ng mail",
        "暂时无法确认取件方式，请稍后重试": "Hindi magamit ang mga setting ng access sa mail. Subukan muli mamaya.",
        "密钥无效或已撤销授权": "Hindi wasto ang key o binawi na ang access nito",
        "管理员级别": "Antas ng admin",
        "管理员层级树": "Hierarchy ng mga admin",
        "个可见账号": "nakikitang account",
        "适应画布": "Ipagkasya sa view",
        "放大": "Palakihin",
        "缩小": "Paliitin",
        "展开下级": "Palawakin ang mga anak",
        "收起下级": "Paliitin ang mga anak",
        "拖动画布 · 双指或 Ctrl + 滚轮缩放 · 点击节点查看详情": "I-drag upang gumalaw · Mag-pinch o Ctrl + scroll upang mag-zoom · Pumili ng node para sa detalye",
        "仅展示上级关系": "Ugnayan sa magulang lamang",
        "子级管理员": "Subordinate na admin",
        "暂无管理员": "Walang admin",
        "已更新层级树": "Na-update na ang hierarchy",
        "查看层级与授权规则": "Tingnan ang hierarchy at mga patakaran ng pahintulot",
        "一级管理员": "Admin sa antas 1",
        "二级管理员": "Admin sa antas 2",
        "三级管理员": "Admin sa antas 3",
        "内置管理员": "Built-in na admin",
        "一级管理员可创建二级或三级；二级管理员可创建直属三级；三级管理员不能再创建下级。新账号默认不授予功能权限。": "Maaaring gumawa ang antas 1 ng mga account sa antas 2 o 3. Maaaring gumawa ang antas 2 ng direktang antas 3. Hindi maaaring gumawa ang antas 3 ng mga anak na account. Walang pahintulot sa mga feature ang mga bagong account bilang default.",
        "tjt740 为一级；lhm、pink 为内置二级，保留原有功能权限和邮箱范围，不参与普通子账号的功能授权。": "Antas 1 si tjt740. Built-in na antas 2 sina lhm at pink at mananatili ang kanilang mga pahintulot at saklaw ng mailbox; hindi sila kasama sa mga setting ng pahintulot ng karaniwang anak na account.",
        "三级管理员不能创建或管理下级": "Hindi maaaring gumawa o mamahala ng mga anak na account ang mga admin sa antas 3.",
        "管理员级别必须为二级或三级": "Pumili ng admin sa antas 2 o 3.",
        "只有一级管理员可以创建二级管理员": "Mga admin sa antas 1 lamang ang maaaring gumawa ng mga admin sa antas 2.",
        "归属上级的级别必须高于新管理员": "Dapat mas mataas ang antas ng magulang na admin kaysa sa bagong account.",
        "内置管理员用户名已保留": "Nakalaan na ang mga username ng built-in na admin.",
        "归属上级（可选）": "Magulang na admin (opsyonal)",
        "普通管理员仅能管理直属下级；最高管理员可查看全部账号。新账号默认不授予功能权限。": "Mga direktang subordinate lamang ang maaaring pamahalaan ng admin; makikita ng super admin ang lahat ng account. Walang pahintulot sa mga feature ang bagong account bilang default.",
        "不指定（默认归属当前管理员）": "Gamitin ang kasalukuyang admin bilang default",
        "不选择时，新账号归属当前管理员。": "Kapag walang napili, mapapabilang ang bagong account sa kasalukuyang admin.",
        "归属上级格式错误，请重新选择": "Hindi wasto ang magulang na admin. Pumili muli.",
        "只能将新管理员归属到自己名下": "Sa ilalim lamang ng iyong account maaaring gumawa ng mga admin.",
        "归属上级不存在，请刷新后重新选择": "Hindi na umiiral ang magulang na admin. I-refresh at pumili muli.",
        "请先为目标管理员的上级授予所需权限": "Ibigay muna ang kailangang pahintulot sa magulang na admin.",
        "归属上级": "Magulang na admin",
        "最高管理员": "Super admin",
        "功能授权": "Mga pahintulot sa feature",
        "保存功能授权": "I-save ang mga pahintulot",
        "不可管理": "Hindi maaaring pamahalaan",
        "首页统计": "Mga estadistika ng dashboard",
        "查看全部邮箱（跨账号）": "Tingnan ang lahat ng mailbox (lahat ng account)",
        "代理池管理（全站）": "Pamamahala ng proxy (buong site)",
        "卡密管理（全站）": "Pamamahala ng key (buong site)",
        "卡密日志（全站）": "Mga log ng key (buong site)",
        "系统设置（标题、服务器、轮询）": "Mga setting ng system (pamagat, server, polling)",
        "管理直属下级及功能授权": "Pamahalaan ang mga direktang subordinate at pahintulot nila",
        "授权直属下级邮箱范围": "Bigyan ng access sa mailbox ang mga direktang subordinate",
        "设置和使用本人万能密钥": "Itakda at gamitin ang sariling master key",
        "展示系统整体状态：邮箱账号、卡密、代理数量与自动轮询运行情况。点击功能导航卡片进入各模块。": "Ipinapakita ang kabuuang mailbox, key, at proxy at ang katayuan ng awtomatikong polling. Pumili ng navigation card upang magbukas ng module.",
        "邮箱账号总数：已配置的收件邮箱数量。": "Kabuuang mailbox: bilang ng mga naka-configure na account na tumatanggap ng mail.",
        "卡密总数：已生成的卡密数量。": "Kabuuang access key: bilang ng mga nagawang key.",
        "可用代理数量：代理池中可用的代理数。": "Mga magagamit na proxy: bilang ng mga proxy na maaaring gamitin sa pool.",
        "自动轮询：后台定时收件的当前状态（运行中 / 空闲 / 已暂停 / 已禁用）。": "Awtomatikong polling: katayuan ng naka-iskedyul na pagkuha ng mail (tumatakbo / walang ginagawa / naka-pause / naka-disable).",
        "配置用于收件的邮箱账号，支持单个 / 批量添加、分组、测试连通性、手动收件与发件。": "Mag-configure ng mga account nang paisa-isa o maramihan, ayusin ang mga grupo, subukan ang koneksyon, at manu-manong tumanggap o magpadala ng mail.",
        "「添加邮箱」下拉：单个添加、批量添加、添加服务器地址。": "Maaaring magdagdag ng isang account, mag-import nang maramihan, at magdagdag ng address ng server sa menu ng pagdagdag ng mailbox.",
        "需填写邮箱、密码/授权码、IMAP/SMTP 服务器与端口；可选 SSL。": "Ilagay ang email, password o app password, at IMAP/SMTP server at port. Opsyonal ang SSL.",
        "OAuth 邮箱（如 Outlook）在备注标记「OAuth登录」，通过刷新令牌收件。": "May markang “OAuth登录” sa mga tala ang mga OAuth account (tulad ng Outlook) at gumagamit ng refresh token para kumuha ng mail.",
        "勾选多行后，底部会滑出批量操作条：批量复制、批量分组、批量删除。": "Kapag pumili ng maraming row, bubukas ang action bar sa ibaba para kopyahin, igrupo, o tanggalin ang mga napiling account.",
        "「视图」按钮可切换分组显示与自定义显示列。": "Gamitin ang mga kontrol ng view upang ipakita o itago ang mga grupo at pumili ng mga column.",
        "编辑 / 收件 / 测试 / 删除 / 更多（备注、发件等）。": "I-edit / Tumanggap / Subukan / Tanggalin / Higit pa (mga tala, pagpapadala ng mail, atbp.).",
        "测试：验证邮箱能否正常登录收件；状态列显示「邮箱正常 / 异常 / 未检测」。": "Sinusuri ng test ang login at pagkuha ng mail. Makikita sa column ng katayuan kung maayos ang account, may error, o hindi pa nasusuri.",
        "管理 HTTP / SOCKS5 代理，用于通过代理连接邮箱服务器，降低直连被限制的风险。": "Pamahalaan ang mga HTTP/SOCKS5 proxy para kumonekta sa mga mail server at mabawasan ang mga limitasyon sa direktang koneksyon.",
        "支持添加 HTTP 与 SOCKS5 两类代理。": "Sinusuportahan ang mga HTTP at SOCKS5 proxy.",
        "「开启代理」会自动选择延迟最低的代理；也可手动切换到指定代理。": "Awtomatikong pinipili ang server na may pinakamababang latency kapag naka-enable ang proxy. Maaari ring pumili nang manu-mano.",
        "密码列默认打码，点击眼睛图标显示、点击复制图标复制。": "Nakatago ang mga password bilang default. Gamitin ang icon ng mata upang ipakita o ang icon ng kopya upang kopyahin.",
        "当前所有邮箱共用同一个启用中的代理，是潜在的单点瓶颈（见帮助中心的轮询说明）。": "Iisa ang aktibong proxy na ginagamit ng lahat ng mailbox, kaya maaari itong maging bottleneck. Tingnan ang gabay sa polling sa sentro ng tulong.",
        "生成并管理访问卡密。卡密是前台用户查看邮件的凭证，可限制使用次数、有效期与绑定邮箱。": "Gumawa at mamahala ng mga access key para makita ang mail, na may limitasyon ng paggamit, petsa ng pag-expire, at naka-link na mga mailbox.",
        "单个生成或批量生成；可设置使用次数上限、有效期、收取范围（天数）与关键词过滤。": "Gumawa ng isang key o maramihan. Itakda ang limitasyon ng paggamit, pag-expire, edad ng mail sa mga araw, at mga filter ng keyword.",
        "可将卡密绑定到一个或多个邮箱，绑定后该卡密只能查询这些邮箱。": "I-link ang key sa isa o higit pang mailbox upang limitahan ang access nito sa mga account na iyon.",
        "使用情况：已用次数 / 上限，下方为最近使用时间。": "Paggamit: nagamit / limitasyon, at nasa ibaba ang huling paggamit.",
        "有效期：到期时间，留空为永久有效。": "Bisa: petsa ng pag-expire; walang laman para hindi mag-expire.",
        "备注 / 过滤：备注文字与收取范围、关键词过滤。": "Mga tala / Filter: mga tala, limitasyon ng edad ng mail, at mga keyword.",
        "删除或过期的卡密进入回收站，可恢复或彻底清理。": "Napupunta sa recycle bin ang mga natanggal o nag-expire na key, kung saan maaaring ibalik o permanenteng tanggalin.",
        "记录每次卡密的使用与查询：谁在什么时间用哪个卡密查询了哪个邮箱。": "Itinatala ang paggamit at paghahanap ng key: sino ang nag-access ng mailbox, gamit ang anong key, at kailan.",
        "卡密 / 绑定邮箱 / 邮件标题 / 使用者IP / 使用时间（北京时间）。": "Key / Naka-link na mailbox / Paksa ng mail / IP ng gumagamit / Oras ng paggamit (oras sa Beijing).",
        "action=use 表示成功取件；action=check 表示查询了卡密信息（不消耗次数）。": "Ang action=use ay matagumpay na pagkuha ng mail; ang action=check ay paghahanap ng impormasyon ng key at hindi bumabawas sa bilang ng paggamit.",
        "「保留天数」设为 0 表示不清理；设为 N 表示自动删除 N 天前的卡密日志。": "Itakda sa 0 upang panatilihin ang lahat ng log, o N upang awtomatikong burahin ang mga log ng key na mas matanda sa N araw.",
        "查看后台自动收件的结果，并控制自动轮询的开关、间隔、日志保留与失败退避。": "Tingnan ang resulta ng awtomatikong pagkuha ng mail at kontrolin ang polling, agwat, pagpapanatili ng log, at backoff kapag nabigo.",
        "自动轮询：后台按间隔定时收取所有启用邮箱的最新邮件。": "Kinukuha ng awtomatikong polling ang pinakabagong mail mula sa lahat ng naka-enable na mailbox ayon sa itinakdang agwat.",
        "立即查询：手动触发一次轮询（会忽略失败退避，相当于立即重试）。": "Manu-manong nagsisimula ng isang polling round ang paghahanap ngayon, na lumalaktaw sa backoff upang subukang muli ang mga nabigong account.",
        "状态值：received 成功 / failed 失败 / processed 已处理。": "Mga katayuan: received (natanggap) / failed (nabigo) / processed (naproseso).",
        "自动轮询开关：关闭后暂停定时收件，约 30 秒内生效，无需重启。": "Kapag naka-off ang awtomatikong polling, titigil ang naka-iskedyul na pagkuha sa loob ng humigit-kumulang 30 segundo nang walang pag-restart.",
        "间隔(秒)：两次轮询之间的等待时间，最低 30 秒。": "Agwat (segundo): oras ng paghihintay sa pagitan ng mga polling round, hindi bababa sa 30 segundo.",
        "日志保留(天)：0 为不清理；设为 N 自动删除 N 天前的收件日志，防止数据库膨胀。": "Pagpapanatili (araw): pinapanatili ng 0 ang lahat ng log; awtomatikong binubura ng N ang mga log na mas matanda sa N araw upang limitahan ang paglaki ng database.",
        "退避中 N 个：连续失败的邮箱会被暂时跳过，可展开查看并重置。": "Mga account sa backoff: pansamantalang nilalaktawan ang mga mailbox na paulit-ulit na nabibigo. Palawakin ang listahan upang suriin o i-reset.",
        "每个邮箱每轮抓取最新 5 封、仅看最近 7 天、仅 INBOX。": "Bawat round, kinukuha ang pinakahuling 5 mensahe sa bawat mailbox mula sa nakaraang 7 araw, sa INBOX lamang.",
        "按「邮箱 + Message-ID」去重，避免重复记录。": "Tinatanggal ang mga dobleng mensahe batay sa mailbox at Message-ID upang maiwasan ang dobleng log.",
        "连续失败达阈值（默认 3 次）后进入指数退避（跳过 2→4→8→16 轮），成功后自动恢复。": "Pagkatapos maabot ang limitasyon ng sunod-sunod na pagkabigo (3 bilang default), nilalaktawan ng exponential backoff ang 2→4→8→16 round. Nire-reset ito ng matagumpay na pagkuha.",
        "管理管理员账号、万能秘钥、系统与页面标题等。左侧锚点可快速跳转到各设置区块。": "Pamahalaan ang mga account ng admin, master key, at mga pamagat ng system/pahina. Gamitin ang kaliwang navigation upang pumunta sa isang seksyon ng setting.",
        "管理员账号：修改当前管理员用户名与密码。": "Account ng admin: baguhin ang iyong username at password.",
        "后台管理员管理：新增/重置/删除其它管理员账号。": "Pamamahala ng admin: magdagdag, mag-reset, o magtanggal ng ibang account ng admin.",
        "万能秘钥：一个无需卡密即可查询任意邮箱的超级凭证，请妥善保管。": "Master key: maaaring hanapin ang anumang mailbox nang walang access key. Panatilihin itong ligtas.",
        "系统标题 / 页面标题：自定义站点显示名称。": "Mga pamagat ng system / pahina: baguhin ang mga pangalang ipinapakita sa site.",
        "为什么收不到邮件？": "Bakit hindi ako nakakatanggap ng mail?",
        "① 邮箱配置或授权码错误——用「测试」按钮验证；② 该邮箱触发了失败退避，被暂时跳过——在收件日志页展开退避列表并重置；③ 使用了 OAuth 的邮箱刷新令牌失效；④ 代理不可用导致连接失败。": "Mga posibleng dahilan: maling setting ng mailbox o app password (gamitin ang test); nasa backoff ang mailbox (palawakin at i-reset sa mga log ng mail); nag-expire ang OAuth refresh token; o hindi magamit ang proxy.",
        "自动轮询多久收一次？": "Gaano kadalas tumatakbo ang awtomatikong polling?",
        "由「轮询间隔」决定，默认 300 秒（5 分钟），最低 30 秒。可在收件日志页的轮询控制面板调整，改动在当前周期结束后生效。": "Karaniwang 300 segundo (5 minuto) ang agwat, hindi bababa sa 30 segundo. Baguhin sa mga log ng mail; magkakabisa pagkatapos ng kasalukuyang round.",
        "卡密的使用次数怎么算？": "Paano binibilang ang paggamit ng key?",
        "每成功取件一次消耗一次；查询卡密信息（check）不消耗次数。次数用完后卡密变为「次数用完」状态，无法再查询。": "Bawat matagumpay na pagkuha ay bumabawas ng isang paggamit. Hindi bumabawas ang paghahanap ng impormasyon ng key (check). Kapag naabot ang limitasyon, hindi na makakahanap ng mail ang key.",
        "代理怎么用？": "Paano gumamit ng proxy?",
        "在代理池添加 HTTP/SOCKS5 代理后点击「开启代理」，系统会自动选延迟最低的代理连接邮箱；也可手动切换。": "Magdagdag ng HTTP/SOCKS5 proxy sa mga proxy at i-enable ito. Awtomatikong pipiliin ang pinakamababang latency; maaari ring lumipat nang manu-mano.",
        "失败退避是什么？": "Ano ang backoff kapag nabigo?",
        "连续失败达到阈值（默认 3 次）的邮箱会被暂时跳过 2→4→8→16 轮，避免反复空耗子进程与触发服务商限流；该邮箱一旦成功收件就自动恢复正常频率。": "Kapag naabot ang limitasyon ng paulit-ulit na pagkabigo (3 bilang default), lalaktawan ng mailbox ang 2→4→8→16 round upang maiwasan ang sayang na proseso at limitasyon ng provider. Ibabalik ng matagumpay na pagkuha ang karaniwang dalas.",
        "收件日志越来越多怎么办？": "Paano limitahan ang lumalaking mga log ng mail?",
        "在收件日志页把「日志保留天数」设为一个正数（如 30），系统会自动清理更早的日志。默认 0 为不清理，长期运行建议开启。": "Itakda ang pagpapanatili ng log sa mga log ng mail sa positibong bilang, tulad ng 30, upang awtomatikong burahin ang mas matatandang log. Pinapanatili ng default na 0 ang lahat; i-enable ang paglilinis para sa matagal na paggamit.",
        "页面操作": "Mga aksyon sa pahina",
        "邮箱账号总数": "Kabuuang mailbox",
        "卡密总数": "Kabuuang access key",
        "可用代理数量": "Mga magagamit na proxy",
        "空闲": "Walang ginagawa",
        "功能导航": "Navigation",
        "使用说明": "Gabay sa paggamit",
        "欢迎使用邮件查看系统管理控制台，点击下方卡片进入对应模块。": "Maligayang pagdating sa admin console ng mail. Pumili ng card sa ibaba upang magbukas ng module.",
        "添加、编辑和删除邮箱账号配置": "Magdagdag, mag-edit, at magtanggal ng mga account ng mailbox",
        "管理代理服务器配置": "Pamahalaan ang mga proxy server",
        "生成和管理访问卡密": "Gumawa at mamahala ng mga access key",
        "查看卡密使用记录": "Tingnan ang kasaysayan ng paggamit ng key",
        "查看邮件接收记录与轮询控制": "Tingnan ang mga log ng mail at mga kontrol ng polling",
        "配置系统参数和安全选项": "I-configure ang system at mga setting ng seguridad",
        "首页 · 概览": "Home · Pangkalahatang-ideya",
        "常见问题": "Mga madalas itanong",
        "统计卡片": "Mga card ng estadistika",
        "前往帮助中心查看全部说明 →": "Tingnan ang lahat ng gabay sa sentro ng tulong →",
        "单个添加": "Magdagdag ng isa",
        "发送": "Magpadala",
        "（可选，粘贴后自动填充）": "(Opsyonal; i-paste para awtomatikong mapunan)",
        "支持 ---- / 冒号 / 竖线 / 逗号 / 分号 / Tab / 空格 / key=value / JSON / CSV 表头": "Tumatanggap ng ----, tutuldok, patayong guhit, kuwit, tuldok-kuwit, tab, espasyo, key=value, JSON, at CSV header",
        "测试邮箱": "Subukan ang mailbox",
        "批量操作": "Mga maramihang aksyon",
        "行内操作": "Mga aksyon sa row",
        "展开分组": "Palawakin ang mga grupo",
        "展开左侧分组": "Palawakin ang sidebar ng mga grupo",
        "清除搜索": "I-clear ang paghahanap",
        "搜索邮件": "Maghanap ng mga email",
        "搜索结果": "Mga resulta ng paghahanap",
        "收取数量": "Bilang ng kukunin",
        "搜索已收取邮件的标题、发件人或正文": "Hanapin ang natanggap na email ayon sa paksa, nagpadala o nilalaman",
        "搜索联想": "Mga mungkahi sa paghahanap",
        "没有匹配的邮件": "Walang tumugmang email",
        "邮件分页": "Mga pahina ng email",
        "按账号状态筛选": "Salain ayon sa katayuan ng account",
        "倒序": "Pababa",
        "新分组名，回车添加": "Bagong pangalan ng grupo; pindutin ang Enter upang idagdag",
        "添加HTTP代理": "Magdagdag ng HTTP proxy",
        "添加SOCKS5代理": "Magdagdag ng SOCKS5 proxy",
        "开启代理": "I-enable ang proxy",
        "关闭代理": "I-disable ang proxy",
        "代理状态：": "Katayuan ng proxy:",
        "未启用": "Hindi naka-enable",
        "点击\"开启代理\"按钮智能选择延迟最低的代理，或手动切换到指定代理": "I-enable ang proxy upang awtomatikong piliin ang server na may pinakamababang latency, o pumili nang manu-mano",
        "类型": "Uri",
        "代理名称": "Pangalan ng proxy",
        "地址:端口": "Address:port",
        "延迟": "Latency",
        "最后检测": "Huling nasuri",
        "暂无代理配置": "Walang naka-configure na proxy",
        "代理地址 *": "Address ng proxy *",
        "端口 *": "Port *",
        "测试代理": "Subukan ang proxy",
        "代理管理": "Pamamahala ng proxy",
        "注意": "Tala",
        "搜索代理名称、地址或备注...": "Hanapin ang pangalan, address, o mga tala ng proxy...",
        "留空将默认为空字符串": "Iwanang walang laman para sa walang halagang field",
        "可选：代理用户名": "Opsyonal: username ng proxy",
        "可选：代理密码": "Opsyonal: password ng proxy",
        "可选：代理备注": "Opsyonal: mga tala ng proxy",
        "总卡密数": "Kabuuang key",
        "可用卡密": "Mga magagamit na key",
        "已使用": "Nagamit na",
        "已过期": "Nag-expire na",
        "批量生成卡密": "Gumawa ng mga key nang maramihan",
        "使用情况": "Paggamit",
        "有效期": "Bisa",
        "备注 / 过滤": "Mga tala / Filter",
        "暂无卡密数据": "Walang access key",
        "使用次数限制": "Limitasyon ng paggamit",
        "收取X天内的邮件": "Kunin ang mail sa nakaraang X araw",
        "关键词邮件": "Mga keyword ng paksa",
        "留空则不限制关键词": "Iwanang walang laman upang payagan ang lahat ng paksa",
        "支持格式：数字天数（如：1、100）、天数+天字（如：1天、7天）或具体日期时间，留空则永不过期，使用北京时间": "Maglagay ng bilang ng araw (hal. 1 o 100), bilang na may 天 (hal. 1天), o petsa at oras sa Beijing. Iwanang walang laman upang hindi mag-expire.",
        "生成数量": "Bilang ng mga key",
        "最多一次生成100个": "Hanggang 100 key bawat paggawa",
        "选择邮箱": "Pumili ng mga mailbox",
        "请选择邮箱账号": "Pumili ng account ng mailbox",
        "绑定": "I-link",
        "编辑卡密": "I-edit ang key",
        "生成API": "Gumawa ng API link",
        "邮箱分组": "Mga grupo ng mailbox",
        "确定选择": "Kumpirmahin ang pagpili",
        "卡密回收站": "Recycle bin ng key",
        "已删除的卡密": "Mga natanggal na key",
        "已过期的卡密": "Mga nag-expire na key",
        "已删除的卡密 (": "Mga natanggal na key (",
        "已过期的卡密 (": "Mga nag-expire na key (",
        "批量恢复": "Ibalik ang napili",
        "批量永久删除": "Permanenteng tanggalin ang napili",
        "晴天": "Maaraw",
        "夜间": "Gabi",
        "天蓝 · 杏黄 · 薄荷绿": "Asul na langit · Aprikot · Mint",
        "深蓝 · 星紫 · 月光金": "Malalim na asul · Lila · Ginto ng buwan",
        "蓝灰 · 青绿 · 霓虹玫红": "Abuhing asul · Teal · Neon na rosas",
        "邮局运行总览": "Pangkalahatang-ideya ng mail",
        "邮箱健康、收件动态与服务状态，一眼掌握。": "Kalusugan ng mailbox, aktibidad ng mail, at katayuan ng serbisyo sa isang tingin.",
        "正在同步监测数据…": "Sini-sync ang data ng monitoring…",
        "刷新数据": "I-refresh ang data",
        "每 30 秒自动刷新 · 北京时间": "Awtomatikong nire-refresh bawat 30 segundo · Oras sa Beijing",
        "最近更新": "Huling na-update",
        "可见邮箱": "Mga naa-access na mailbox",
        "当前管理员可访问的邮箱": "Mga mailbox na naa-access ng admin na ito",
        "正常邮箱占比": "Mga maayos na mailbox",
        "按最近一次检测结果": "Batay sa pinakabagong resulta ng pagsusuri",
        "今日收件记录": "Mail na natanggap ngayon",
        "按日志记录时间统计": "Binibilang ayon sa oras ng log",
        "今日失败记录": "Mga pagkabigo ngayon",
        "失败记录不等于失效邮箱": "Hindi nangangahulugang hindi wasto ang mailbox kapag nabigo ang isang pagtatangka",
        "收件趋势": "Aktibidad ng mail",
        "最近 7 天 · 按日志记录数统计": "Nakaraang 7 araw · Bilang ng mga log",
        "最近七天收件与失败记录趋势": "Mail na natanggap at mga pagkabigo sa nakaraang pitong araw",
        "选择日期查看记录数": "Pumili ng petsa upang tingnan ang mga bilang",
        "选择下方日期查看记录数": "Pumili ng petsa sa ibaba upang tingnan ang mga bilang",
        "邮箱健康分布": "Kalusugan ng mailbox",
        "最近一次检测结果": "Pinakabagong resulta ng pagsusuri",
        "管理邮箱 →": "Pamahalaan ang mga mailbox →",
        "未检测与网络异常均不计为正常。": "Hindi kasama sa bilang ng maayos ang mga hindi pa nasusuri at may error sa network.",
        "后台收件任务": "Pagkuha ng mail sa background",
        "资源余量": "Mga magagamit na resource",
        "代理与访问卡密": "Mga proxy at access key",
        "启用代理": "Mga naka-enable na proxy",
        "代理启用状态不代表实时连通性。": "Hindi ipinapakita ng katayuang naka-enable ang kasalukuyang koneksyon.",
        "需要关注": "Kailangang suriin",
        "邮箱检测与近期失败": "Mga pagsusuri ng mailbox at kamakailang pagkabigo",
        "查看收件日志 →": "Tingnan ang mga log ng mail →",
        "无权限": "Walang access",
        "最近检测平均延迟": "Karaniwang latency ng pinakabagong mga pagsusuri",
        "需要代理池权限": "Kailangan ng access sa mga proxy",
        "已检测": "Nasuri na",
        "正常邮箱": "Mga maayos na mailbox",
        "等待下次轮询": "Naghihintay sa susunod na polling",
        "请求超时": "Nag-timeout ang request",
        "可用卡密未过期且仍有次数": "Hindi pa nag-expire ang mga magagamit na key at may natitirang paggamit",
        "需要卡密管理权限": "Kailangan ng access sa pamamahala ng key",
        "上次检查邮箱": "Mga mailbox na nasuri sa huling run",
        "上次新增 / 失败": "Huling run: bago / nabigo",
        "上次完成": "Huling natapos",
        "下次计划": "Susunod na nakaiskedyul na run",
        "需要系统设置权限": "Kailangan ng access sa mga setting ng system",
        "近 7 天暂无失败记录": "Walang pagkabigo sa nakaraang 7 araw",
        "需要收件日志权限": "Kailangan ng access sa mga log ng mail",
        "会话已过期，请重新登录": "Nag-expire ang session. Mag-login muli.",
        "监测数据暂时不可用，请稍后重试": "Pansamantalang hindi magamit ang data ng monitoring. Subukan muli mamaya.",
        "更新失败": "Hindi ma-update",
        "保留上次数据": "Ipinapakita ang huling matagumpay na update",
        "邮箱工作台": "Workspace ng mailbox",
        "新建分组": "Bagong grupo",
        "查找分组": "Hanapin ang grupo",
        "分组操作": "Mga aksyon sa grupo",
        "按分组找到邮箱，点击地址即可复制。": "Hanapin ang mailbox ayon sa grupo. I-click ang address upang kopyahin.",
        "在当前分组搜索邮箱、备注或服务器": "Hanapin ang mga address, tala, o server sa grupong ito",
        "选择邮箱分组": "Pumili ng grupo ng mailbox",
        "展开分组侧栏": "Ipakita ang sidebar ng mga grupo",
        "收起分组侧栏": "Itago ang sidebar ng mga grupo",
        "展开子分组": "Palawakin ang mga subgrupo",
        "收起子分组": "Paliitin ang mga subgrupo",
        "重置筛选": "I-reset ang mga filter",
        "无效邮箱": "Hindi wasto",
        "无效": "Hindi wasto",
        "待重试": "Kailangang subukan muli",
        "点击邮箱地址复制": "I-click ang address upang kopyahin",
        "查看详情": "Tingnan ang mga detalye",
        "收起详情": "Itago ang mga detalye",
        "关闭测试结果": "Isara ang resulta ng pagsusuri",
        "封禁或凭据失效的邮箱。可编辑凭据后重试，或勾选后批量删除。": "Mga naka-block na account o hindi wastong kredensyal. I-update ang mga kredensyal at subukan muli, o pumili ng mga mailbox na tatanggalin.",
        "网络或检测异常，尚不能判断邮箱无效。可以批量重试。": "Hindi nangangahulugang hindi wasto ang mailbox kapag may error sa network o pagsusuri. Subukan muli ang mga mailbox na ito nang maramihan.",
        "这些邮箱尚未测试，可勾选测试或测试全部筛选结果。": "Hindi pa nasusuri ang mga mailbox na ito. Subukan ang napili o ang lahat ng resulta ng filter.",
        "没有符合条件的邮箱": "Walang tumugmang mailbox",
        "试试其他关键词、切换分组，或添加一个邮箱。": "Subukan ang ibang keyword, lumipat ng grupo, o magdagdag ng mailbox.",
        "上一邮箱": "Nakaraang mailbox",
        "下一邮箱": "Susunod na mailbox",
        "邮箱批量管理": "Maramihang pamamahala ng mailbox",
        "测试筛选结果": "Subukan ang mga nasalang mailbox",
        "筛选无效": "Salain ang mga hindi wastong mailbox",
        "全选筛选结果": "Piliin ang lahat ng nasalang mailbox",
        "测试选中邮箱": "Subukan ang mga napiling mailbox",
        "批量测试": "Maramihang pagsusuri",
        "批量测试结果": "Mga resulta ng maramihang pagsusuri",
        "测试进度": "Progreso ng pagsusuri",
        "失败邮箱日志": "Mga log ng nabigong mailbox",
        "仅显示本次测试失败的邮箱": "Mga kabiguan lamang mula sa pagsusuring ito",
        "测试进行中，失败日志将实时显示在这里。": "Isinasagawa ang pagsusuri. Lalabas dito ang mga log ng nabigong mailbox.",
        "已完成的测试中暂无失败记录。": "Walang kabiguan sa mga natapos na pagsusuri.",
        "本次测试全部通过，无失败记录。": "Pumasa ang lahat ng pagsusuri. Walang naitalang kabiguan.",
        "未测试": "Hindi pa nasusuri",
        "无效邮箱（封禁 / 凭据失效）": "Hindi wasto (naka-block / nag-expire na kredensyal)",
        "无效邮箱包括封禁、凭据失效；网络异常和检测异常请重试。批量操作覆盖当前搜索、分组、操作人及状态筛选下的所有页。": "Kasama sa hindi wasto ang mga naka-block na account at hindi wastong kredensyal. Subukan muli ang mga error sa network at pagsusuri. Saklaw ng maramihang aksyon ang lahat ng pahina na tumutugma sa kasalukuyang paghahanap, grupo, operator, at filter ng katayuan.",
        "停止测试": "Itigil ang pagsusuri",
        "批量测试中": "Sinusuri ang mga mailbox",
        "批量测试完成": "Tapos na ang maramihang pagsusuri",
        "批量测试已停止": "Itinigil ang maramihang pagsusuri",
        "正在停止（等待进行中的测试完成）": "Humihinto (hinihintay ang mga aktibong pagsusuri)",
        "请选择要测试的邮箱": "Piliin ang mga mailbox na susuriin",
        "已有批量测试正在运行，新导入邮箱可稍后筛选未检测并测试": "May tumatakbong maramihang pagsusuri. Salain ang mga hindi pa nasusuring mailbox mamaya upang subukan ang mga bagong import.",
        "请先停止批量测试，等待进行中的测试完成后再删除": "Itigil ang maramihang pagsusuri at hintaying matapos ang mga aktibong pagsusuri bago magtanggal.",
        "删除时间": "Oras ng pagtanggal",
        "删除原因": "Dahilan ng pagtanggal",
        "过期原因": "Dahilan ng pag-expire",
        "清空回收站": "Alisan ng laman ang recycle bin",
        "列表字段": "Mga field ng listahan",
        "搜索卡密...": "Hanapin ang mga key...",
        "设置关键词后只收取标题包含关键词的邮件，多个关键词用逗号分隔": "Kunin lang ang mga mensahe na may mga keyword na ito sa paksa. Paghiwalayin ang mga keyword gamit ang kuwit.",
        "支持格式：1、7、30、100 或 1天、7天、30天 或具体日期时间": "Maglagay ng mga araw: 1, 7, 30, 100; 1天, 7天, 30天; o petsa at oras",
        "卡密用途说明": "Ilarawan ang layunin ng key na ito",
        "批量卡密用途说明": "Ilarawan ang layunin ng mga key na ito",
        "点击选择按钮选择一个或多个邮箱": "Gamitin ang pagpili upang pumili ng isa o higit pang mailbox",
        "搜索邮箱地址...": "Hanapin ang mga email address...",
        "卡密被使用后，记录会显示在这里": "Makikita rito ang mga rekord ng paggamit kapag nagamit ang key",
        "字段说明": "Mga paglalarawan ng field",
        "定期清理": "Naka-iskedyul na paglilinis",
        "日志保留天数": "Mga araw ng pagpapanatili ng log",
        "成功": "Tagumpay",
        "失败": "Nabigo",
        "间隔(秒)": "Agwat (segundo)",
        "日志保留(天)": "Pagpapanatili (araw)",
        "退避中": "Nasa backoff",
        "个 ▾": "account ▾",
        "未启动": "Hindi pa nagsisimula",
        "下次轮询": "Susunod na polling",
        "邮件自动轮询尚未启动": "Hindi pa nagsisimula ang awtomatikong polling ng mail",
        "收件日志 · 轮询控制": "Mga log ng mail · Mga kontrol ng polling",
        "日志来源": "Mga pinagmulan ng log",
        "轮询控制面板": "Mga kontrol ng polling",
        "轮询机制": "Paano gumagana ang polling",
        "按收件状态筛选：成功/失败/已处理": "Salain ayon sa katayuan: natanggap / nabigo / naproseso",
        "关闭后自动轮询暂停，约30秒内生效，无需重启": "Kapag naka-off, hihinto ang polling sa loob ng humigit-kumulang 30 segundo nang walang pag-restart",
        "账号设置": "Mga setting ng account",
        "管理员管理": "Pamahalaan ang mga admin",
        "系统标题": "Pamagat ng system",
        "页面标题": "Mga pamagat ng pahina",
        "管理员账号设置": "Mga setting ng account ng admin",
        "管理员用户名": "Username ng admin",
        "管理员密码": "Password ng admin",
        "确认密码": "Kumpirmahin ang password",
        "更新管理员账号": "I-update ang account ng admin",
        "后台管理员管理": "Pamahalaan ang mga account ng admin",
        "创建时间": "Petsa ng paggawa",
        "当前登录": "Naka-login",
        "当前账号": "Kasalukuyang account",
        "重置账号": "I-reset ang account",
        "新密码": "Bagong password",
        "确认新密码": "Kumpirmahin ang bagong password",
        "保存新密码": "I-save ang bagong password",
        "新管理员用户名": "Username ng bagong admin",
        "新管理员密码": "Password ng bagong admin",
        "确认新管理员密码": "Kumpirmahin ang password ng bagong admin",
        "保存后只存储安全哈希，不会回显明文；请以右侧状态为准。": "Ligtas na hash lamang ang isi-save. Hindi ipapakita ang plain text; tingnan ang katayuan sa kanan.",
        "当前状态": "Kasalukuyang katayuan",
        "设置万能秘钥": "Itakda ang master key",
        "系统名称/标题": "Pangalan / pamagat ng system",
        "显示在后端管理页面标题中的系统名称，修改后即时生效": "Pangalan ng system sa mga pamagat ng pahina ng admin; agad magkakabisa ang mga pagbabago",
        "更新系统标题": "I-update ang pamagat ng system",
        "API取件页面标题": "Pamagat ng pahina ng mail sa API",
        "显示在API取件页面的标题": "Pamagat na ipinapakita sa pahina ng mail sa API",
        "前端取件页面标题": "Pamagat ng pampublikong pahina ng mail",
        "显示在前端取件页面的标题": "Pamagat na ipinapakita sa pampublikong pahina ng mail",
        "管理员登录页面标题": "Pamagat ng pahina ng pag-login ng admin",
        "显示在管理员登录页面的标题": "Pamagat na ipinapakita sa pahina ng pag-login ng admin",
        "更新页面标题": "I-update ang mga pamagat ng pahina",
        "系统名称": "Pangalan ng system",
        "系统版本": "Bersyon ng system",
        "数据库类型": "Uri ng database",
        "设置项": "Mga setting",
        "系统设置栏目": "Mga seksyon ng setting ng system",
        "输入新的管理员用户名": "Ilagay ang bagong username ng admin",
        "输入新的管理员密码": "Ilagay ang bagong password ng admin",
        "再次输入密码确认": "Ilagay muli ang password",
        "至少4位": "Hindi bababa sa 4 na character",
        "输入新管理员用户名": "Ilagay ang username ng bagong admin",
        "至少6位，设置后可免卡密取件": "Hindi bababa sa 6 na character; kumuha ng mail nang walang access key pagkatapos itakda",
        "显示或隐藏万能秘钥": "Ipakita o itago ang master key",
        "📖 帮助中心": "📖 Sentro ng tulong",
        "这里汇总了各功能模块的使用说明、字段释义与常见问题。每个后台页面右上角也有「使用说明」按钮可随时查看。": "Makikita rito ang mga gabay ng module, paglalarawan ng field, at mga madalas itanong. Nagbubukas din ng tulong ang gabay sa paggamit sa bawat pahina ng admin.",
        "定时触发": "Naka-iskedyul na trigger",
        "遍历启用邮箱": "Puntahan ang mga naka-enable na mailbox",
        "跳过退避中的邮箱": "Laktawan ang mga mailbox sa backoff",
        "IMAP 收取最新邮件": "Kunin ang pinakabagong mail sa IMAP",
        "去重写入日志": "Alisin ang mga doble at i-save ang mga log",
        "失败则退避/成功则恢复": "Mag-backoff kapag nabigo; magpatuloy kapag matagumpay",
        "帮助中心": "Sentro ng tulong",
        "后台管理": "Admin console",
        "后台页面": "Pahina ng admin",
        "退出": "Mag-logout",
        "用户名或密码错误": "Maling username o password",
        "页面加载中": "Nilo-load ang pahina",
        "页面加载时间较长，请重试": "Matagal mag-load ang pahinang ito. Subukan muli.",
        "重试": "Subukan muli",
        "关闭菜单": "Isara ang menu",
        "邮件文件夹": "Mga folder ng mail",
        "邮箱切换": "Lumipat ng mailbox",
        "正在获取邮件，请稍候": "Kinukuha ang mail. Mangyaring maghintay",
        "账号状态": "Katayuan ng account",
        "邮箱详情": "Mga detalye ng mailbox",
        "账号资料": "Data ng account",
        "账号搜索": "Paghahanap ng account",
        "搜索邮箱或登录用户名": "Hanapin ang email o username sa pag-login",
        "创建人": "Ginawa ni",
        "全部创建人": "Lahat ng gumawa",
        "分类（邮箱分组）": "Kategorya (grupo ng mailbox)",
        "全部分类": "Lahat ng kategorya",
        "分类": "Kategorya",
        "认证方式": "Authentication",
        "全部认证方式": "Lahat ng uri ng authentication",
        "密码登录": "Pag-login gamit ang password",
        "开始日期": "Petsa ng simula",
        "结束日期": "Petsa ng pagtatapos",
        "开始日期不能晚于结束日期": "Hindi maaaring mas huli ang petsa ng simula kaysa sa petsa ng pagtatapos",
        "筛选参数无效，请检查日期范围和分类": "Hindi wasto ang mga filter. Suriin ang saklaw ng petsa at kategorya.",
        "请选择 1 至 5000 个账号": "Pumili ng 1 hanggang 5,000 account",
        "全选本页": "Piliin ang pahinang ito",
        "筛选结果": "Mga resulta",
        "复制所选": "Kopyahin ang napili",
        "清空选择": "Alisin ang pagpili",
        "显示凭据": "Ipakita ang mga kredensyal",
        "复制格式": "Format ng kopya",
        "跨页保留勾选；应用筛选后清空。复制始终使用完整原值，每个账号一行。": "Mananatili ang pagpili sa ibang pahina at malilinis kapag inilapat ang mga filter. Buong orihinal na halaga ang kinokopya, isang account bawat linya.",
        "没有符合条件的账号": "Walang tumugmang account",
        "筛选": "Salain",
        "未获上级授权使用此功能": "Wala kang pahintulot na gamitin ang feature na ito",
        "邮箱不存在或无权访问": "Hindi makita ang mailbox o tinanggihan ang access",
        "正在加载邮箱详情…": "Nilo-load ang mga detalye ng mailbox…",
        "以下为当前保存的邮箱配置；密码和令牌可点击显示或复制。": "Ito ang mga kasalukuyang naka-save na setting ng mailbox. Gamitin ang mga button upang ipakita o kopyahin ang mga password at token.",
        "基本信息": "Pangunahing impormasyon",
        "登录用户名": "Username sa pag-login",
        "邮箱 ID": "ID ng mailbox",
        "认证与 OAuth": "Authentication at OAuth",
        "认证方式 (auth_type)": "Uri ng authentication (auth_type)",
        "密码 / 授权码": "Password / App password",
        "收件配置": "Mga setting ng papasok na mail",
        "发件配置": "Mga setting ng papalabas na mail",
        "服务器地址": "Address ng server",
        "协议": "Protocol",
        "状态与时间": "Katayuan at mga oras",
        "启用状态": "Katayuan ng pag-enable",
        "最后检测时间": "Huling nasuri",
        "检测结果": "Resulta ng pagsusuri",
        "未设置": "Hindi nakatakda",
        "已开启": "Naka-enable",
        "已关闭": "Naka-disable",
        "显示": "Ipakita",
        "隐藏": "Itago",
        "正常": "Maayos",
        "已删除": "Natanggal",
        "封禁": "Naka-block",
        "凭据失效": "Hindi wastong kredensyal",
        "网络异常": "Error sa network",
        "检测异常": "Error sa pagsusuri",
        "当前为保存前的测试结果。": "Isinagawa ang pagsusuring ito bago i-save.",
        "测试请求未返回账号状态": "Walang ibinalik na katayuan ng account ang pagsusuri",
        "未获得有效检测结果，已保存的账号状态未更改。": "Walang wastong resulta ng pagsusuri. Hindi nagbago ang naka-save na katayuan ng account."
    };
    // Branding settings use the same translations in the shell and embedded pages.
    const brandingMessages = {
        "设置": ["Settings", "Cài đặt", "Mga setting"],
        "页面标题与图标": [
                "Page titles & icon",
                "Tiêu đề và biểu tượng",
                "Mga pamagat at icon"
        ],
        "前台图标": [
                "Public page icon",
                "Biểu tượng trang thư",
                "Icon ng pampublikong pahina"
        ],
        "信封": [
                "Envelope",
                "Phong bì",
                "Sobre"
        ],
        "收件箱": [
                "Inbox",
                "Hộp thư đến",
                "Inbox"
        ],
        "地球": [
                "Globe",
                "Địa cầu",
                "Globo"
        ],
        "火箭": [
                "Rocket",
                "Tên lửa",
                "Rocket"
        ],
        "上传自定义图标": [
                "Upload custom icon",
                "Tải biểu tượng lên",
                "Mag-upload ng icon"
        ],
        "恢复内置图标": [
                "Use built-in icon",
                "Dùng biểu tượng có sẵn",
                "Gamitin ang built-in na icon"
        ],
        "前台预览": [
                "Public page preview",
                "Xem trước trang thư",
                "Preview ng pampublikong pahina"
        ],
        "保存标题与图标": [
                "Save titles & icon",
                "Lưu tiêu đề và biểu tượng",
                "I-save ang mga pamagat at icon"
        ],
        "标题与图标已保存": [
                "Titles and icon saved",
                "Đã lưu tiêu đề và biểu tượng",
                "Na-save ang mga pamagat at icon"
        ],
        "图标图片无效": [
                "Invalid icon image",
                "Ảnh biểu tượng không hợp lệ",
                "Hindi wastong larawan ng icon"
        ],
        "PNG、JPEG、WebP、GIF，最大 2 MB；支持 GIF 动画，建议使用正方形图片。": [
                "PNG, JPEG, WebP or GIF, up to 2 MB. GIF animation is supported; a square image is recommended.",
                "PNG, JPEG, WebP hoặc GIF, tối đa 2 MB. Hỗ trợ GIF động; nên dùng ảnh vuông.",
                "PNG, JPEG, WebP o GIF, hanggang 2 MB. Suportado ang animated GIF; inirerekomenda ang parisukat na larawan."
        ],
        "请选择不超过 2 MB 的 PNG、JPEG、WebP 或 GIF 图片": [
                "Choose a PNG, JPEG, WebP or GIF image up to 2 MB",
                "Chọn ảnh PNG, JPEG, WebP hoặc GIF tối đa 2 MB",
                "Pumili ng PNG, JPEG, WebP o GIF na hanggang 2 MB"
        ],
        "仅 tjt740 可修改；保存后前台刷新即生效。": [
                "Only tjt740 can edit. Refresh the public page after saving.",
                "Chỉ tjt740 được sửa. Tải lại trang thư sau khi lưu.",
                "Si tjt740 lang ang maaaring mag-edit. I-refresh ang pampublikong pahina matapos i-save."
        ],
        "仅 tjt740 可修改标题和图标": [
                "Only tjt740 can edit titles and icons",
                "Chỉ tjt740 được sửa tiêu đề và biểu tượng",
                "Si tjt740 lang ang maaaring mag-edit ng mga pamagat at icon"
        ],
        "标题需为 1–60 个字符的单行文字": [
                "Use a single-line title of 1–60 characters",
                "Dùng tiêu đề một dòng, từ 1–60 ký tự",
                "Gumamit ng isang linyang pamagat na may 1–60 character"
        ],
        "输入邮箱地址，支持多个\n用换行、空格或逗号分隔": [
                "Enter mailbox addresses\nSeparate by lines,\nspaces or commas",
                "Nhập địa chỉ email\nNgăn bằng xuống dòng,\ndấu cách hoặc dấu phẩy",
                "Ilagay ang mga email\nPaghiwalayin ng linya,\nespasyo o kuwit"
        ]
};
    Object.entries(brandingMessages).forEach(([key, values]) => {
        ['en', 'vi', 'fil'].forEach((lang, index) => { dictionary[lang][key] = values[index]; });
    });


    const supplyMessages = {
    "打开信封": ["Open envelope", "Mở phong bì", "Buksan ang sobre"],
    "合上信封": ["Close envelope", "Đóng phong bì", "Isara ang sobre"],
    "等待响应…": ["Waiting for response…", "Đang chờ phản hồi…", "Naghihintay ng tugon…"],
    "点击重试": ["Click to retry", "Nhấn để thử lại", "I-click para subukan muli"],
    "点击检测": ["Click to test", "Nhấn để kiểm tra", "I-click para suriin"],
    "重新测试连通": ["Retry connection test", "Kiểm tra lại kết nối", "Subukang muli ang koneksyon"],
    "显示 Token": ["Show token", "Hiển thị token", "Ipakita ang token"],
    "隐藏 Token": ["Hide token", "Ẩn token", "Itago ang token"],
    "查看已保存的 Token": ["Show saved token", "Xem token đã lưu", "Ipakita ang naka-save na token"],
    "正在读取 Token…": ["Loading token…", "Đang đọc token…", "Nilo-load ang token…"],
    "Token 读取失败": ["Unable to load token", "Không thể đọc token", "Hindi ma-load ang token"],
    "邮局": ["Mailbox", "Hộp thư", "Mailbox"],
    "Supply 邮件服务": [
        "Supply mail service",
        "Dịch vụ thư Supply",
        "Serbisyo ng mail ng Supply"
    ],
    "每个邮箱展示最近 5 封邮件": [
        "Show the latest 5 messages per mailbox",
        "Hiển thị 5 thư mới nhất mỗi hộp thư",
        "Ipakita ang 5 pinakabagong mensahe bawat mailbox"
    ],
    "配置后，前台通过 Supply 获取每个邮箱最近的 5 封邮件。": [
        "Once configured, the public page fetches the latest 5 messages per mailbox from Supply.",
        "Sau khi cấu hình, trang công khai lấy 5 thư mới nhất mỗi hộp thư từ Supply.",
        "Kapag na-configure, kukunin ng pampublikong pahina ang 5 pinakabagong mensahe bawat mailbox mula sa Supply."
    ],
    "仅 tjt740 本人可配置。Token 只保存在服务端，保存后不回显。": [
        "Only tjt740 can configure this token. It is stored on the server and never displayed after saving.",
        "Chỉ tjt740 có thể cấu hình token. Token chỉ được lưu trên máy chủ và không hiển thị lại.",
        "Si tjt740 lamang ang maaaring mag-configure. Nasa server lang ang token at hindi na ipinapakita matapos i-save."
    ],
    "正在读取配置…": [
        "Loading configuration…",
        "Đang tải cấu hình…",
        "Nilo-load ang configuration…"
    ],
    "输入新的 Supply Token": [
        "Enter a new Supply token",
        "Nhập token Supply mới",
        "Ilagay ang bagong Supply token"
    ],
    "验证并保存 Token": [
        "Validate and save token",
        "Xác minh và lưu token",
        "Patunayan at i-save ang token"
    ],
    "正在验证…": [
        "Validating…",
        "Đang xác minh…",
        "Bineberipika…"
    ],
    "已配置 Supply Token": [
        "Supply token configured",
        "Đã cấu hình token Supply",
        "Na-configure na ang Supply token"
    ],
    "尚未配置 Supply Token": [
        "Supply token not configured",
        "Chưa cấu hình token Supply",
        "Hindi pa na-configure ang Supply token"
    ],
    "Token 保存失败": [
        "Failed to save token",
        "Không thể lưu token",
        "Hindi ma-save ang token"
    ],
    "Supply Token 已验证并保存": [
        "Supply token validated and saved",
        "Đã xác minh và lưu token Supply",
        "Napatunayan at na-save ang Supply token"
    ],
    "暂时无法读取邮件服务配置，请刷新重试": [
        "Unable to load mail service configuration. Please refresh.",
        "Không thể tải cấu hình dịch vụ thư. Vui lòng tải lại.",
        "Hindi ma-load ang configuration ng mail. I-refresh ang pahina."
    ],
    "邮件服务凭证已失效，请联系管理员更新": [
        "Mail service credentials have expired. Contact the administrator.",
        "Thông tin xác thực dịch vụ thư đã hết hạn. Hãy liên hệ quản trị viên.",
        "Nag-expire ang credential ng mail service. Makipag-ugnayan sa administrator."
    ],
    "当前邮件服务授权范围内未找到该邮箱": [
        "Mailbox not found within the mail service access scope",
        "Không tìm thấy hộp thư trong phạm vi được cấp quyền",
        "Hindi nakita ang mailbox sa saklaw ng access ng mail service"
    ],
    "邮件服务请求过于频繁，请稍后重试": [
        "Too many mail service requests. Please try again later.",
        "Quá nhiều yêu cầu dịch vụ thư. Vui lòng thử lại sau.",
        "Masyadong maraming request. Subukan ulit mamaya."
    ],
    "邮件服务暂时无法连接，请稍后重试": [
        "Mail service is unavailable. Please try again later.",
        "Không thể kết nối dịch vụ thư. Vui lòng thử lại sau.",
        "Hindi makakonekta sa mail service. Subukan ulit mamaya."
    ],
    "邮件服务配置读写失败，请联系管理员": [
        "Unable to access mail service configuration. Contact the administrator.",
        "Không thể đọc hoặc ghi cấu hình. Hãy liên hệ quản trị viên.",
        "Hindi mabasa o maisulat ang configuration. Makipag-ugnayan sa administrator."
    ],
    "此邮件服务仅支持收件箱": [
        "This mail service only supports the inbox",
        "Dịch vụ thư này chỉ hỗ trợ hộp thư đến",
        "Inbox lang ang sinusuportahan ng mail service na ito"
    ],
    "Token 必须为 16–512 个可见 ASCII 字符": [
        "Token must contain 16–512 visible ASCII characters",
        "Token phải có 16–512 ký tự ASCII hiển thị",
        "Dapat may 16–512 nakikitang ASCII character ang token"
    ],
    "API 连通性": [
        "API connectivity",
        "Kết nối API",
        "Koneksyon sa API"
    ],
    "待检测": [
        "Not tested",
        "Chưa kiểm tra",
        "Hindi pa nasusuri"
    ],
    "已连通": [
        "Connected",
        "Đã kết nối",
        "Nakakonekta"
    ],
    "连接失败": [
        "Connection failed",
        "Kết nối thất bại",
        "Hindi makakonekta"
    ],
    "检测中…": [
        "Checking…",
        "Đang kiểm tra…",
        "Sinusuri…"
    ],
    "测试连通": [
        "Test connection",
        "Kiểm tra kết nối",
        "Subukan ang koneksyon"
    ],
    "检测时间": [
        "Checked at",
        "Thời gian kiểm tra",
        "Oras ng pagsusuri"
    ],
    "响应耗时": [
        "Response time",
        "Thời gian phản hồi",
        "Oras ng tugon"
    ],
    "邮箱收件": [
        "Mail retrieval",
        "Lấy thư",
        "Pagkuha ng mail"
    ],
    "Token 校验": [
        "Token validation",
        "Xác minh token",
        "Pagpapatunay ng token"
    ],
    "展示邮件数量": [
        "Message limit",
        "Số thư hiển thị",
        "Bilang ng ipapakitang mail"
    ],
    "保存数量": [
        "Save limit",
        "Lưu số lượng",
        "I-save ang bilang"
    ],
    "已保存": [
        "Saved",
        "Đã lưu",
        "Na-save"
    ],
    "保存中…": [
        "Saving…",
        "Đang lưu…",
        "Sine-save…"
    ],
    "预览邮箱": [
        "Preview mailbox",
        "Hộp thư xem trước",
        "Mailbox para sa preview"
    ],
    "输入邮箱地址": [
        "Enter an email address",
        "Nhập địa chỉ email",
        "Ilagay ang email address"
    ],
    "预览邮件": [
        "Preview messages",
        "Xem trước thư",
        "I-preview ang mga mensahe"
    ],
    "正在获取邮件…": [
        "Fetching messages…",
        "Đang lấy thư…",
        "Kinukuha ang mga mensahe…"
    ],
    "邮件数量必须为 1–20 的整数": [
        "Message limit must be an integer from 1 to 20",
        "Số thư phải là số nguyên từ 1 đến 20",
        "Dapat isang integer mula 1 hanggang 20 ang bilang ng mail"
    ]
};
    Object.entries(supplyMessages).forEach(([key, values]) => {
        ['en', 'vi', 'fil'].forEach((lang, index) => { dictionary[lang][key] = values[index]; });
    });

    // BEGIN GENERATED TRADITIONAL DATA
    // OpenCC s2tw data, with UI wording overrides. Regenerate with scripts/build_traditional_locale.py.
    const traditionalCharacters = {"㐷":"傌","㐹":"㑶","㐽":"偑","㑇":"㑳","㑈":"倲","㑔":"㑯","㑩":"儸","㓆":"𠗣","㓥":"劏","㓰":"劃","㔉":"劚","㖊":"噚","㖞":"喎","㘎":"㘚","㚯":"㜄","㛀":"媰","㛟":"𡞵","㛠":"𡢃","㛣":"㜏","㛤":"孋","㛿":"𡠹","㟆":"㠏","㟜":"𡾱","㟥":"嵾","㡎":"幓","㤘":"㥮","㤽":"懤","㥪":"慺","㧏":"掆","㧐":"㩳","㧑":"撝","㧟":"擓","㧰":"擽","㨫":"㩜","㭎":"棡","㭏":"椲","㭣":"𣙎","㭤":"樢","㭴":"樫","㱩":"殰","㱮":"殨","㲿":"瀇","㳔":"濧","㳕":"灡","㳠":"澾","㳡":"濄","㳢":"𣾷","㳽":"瀰","㴋":"潚","㶉":"鸂","㶶":"燶","㶽":"煱","㺍":"獱","㻅":"璯","㻏":"𤫩","㻘":"𤪺","䀥":"䁻","䁖":"瞜","䂵":"碽","䃅":"磾","䅉":"稏","䅟":"穇","䅪":"𥢢","䇲":"筴","䉤":"籔","䌶":"䊷","䌷":"紬","䌸":"縳","䌹":"絅","䌺":"䋙","䌻":"䋚","䌼":"綐","䌽":"綵","䌾":"䋻","䌿":"䋹","䍀":"繿","䍁":"繸","䍠":"䍦","䎬":"䎱","䏝":"膞","䑽":"𦪙","䓓":"薵","䓕":"薳","䓖":"藭","䓨":"罃","䗖":"螮","䘛":"𧝞","䘞":"𧜗","䙊":"𧜵","䙌":"䙡","䙓":"襬","䜣":"訢","䜤":"鿁","䜥":"𧩙","䜧":"䜀","䜩":"讌","䝙":"貙","䞌":"𧵳","䞍":"䝼","䞎":"𧶧","䞐":"賰","䟢":"躎","䢀":"𨊰","䢁":"𨊸","䢂":"𨋢","䥺":"釾","䥽":"鏺","䥾":"䥱","䥿":"𨯅","䦀":"𨦫","䦁":"𨧜","䦂":"䥇","䦃":"鐯","䦅":"鐥","䦆":"钁","䦶":"䦛","䦷":"䦟","䩄":"靦","䭪":"𩞯","䯃":"𩣑","䯄":"騧","䯅":"䯀","䲝":"䱽","䲞":"𩶘","䲟":"鮣","䲠":"鰆","䲡":"鰌","䲢":"鰧","䲣":"䱷","䴓":"鳾","䴔":"鵁","䴕":"鴷","䴖":"鶄","䴗":"鶪","䴘":"鷉","䴙":"鸊","䶮":"龑","万":"萬","与":"與","丑":"醜","专":"專","业":"業","丛":"叢","东":"東","丝":"絲","丢":"丟","两":"兩","严":"嚴","丧":"喪","个":"個","丰":"豐","临":"臨","为":"為","丽":"麗","举":"舉","么":"麼","义":"義","乌":"烏","乐":"樂","乔":"喬","习":"習","乡":"鄉","书":"書","买":"買","乱":"亂","争":"爭","于":"於","亏":"虧","云":"雲","亘":"亙","亚":"亞","产":"產","亩":"畝","亲":"親","亵":"褻","亸":"嚲","亿":"億","仅":"僅","仆":"僕","从":"從","仑":"侖","仓":"倉","仪":"儀","们":"們","价":"價","众":"眾","优":"優","伙":"夥","会":"會","伛":"傴","伞":"傘","伟":"偉","传":"傳","伡":"俥","伣":"俔","伤":"傷","伥":"倀","伦":"倫","伧":"傖","伪":"偽","伫":"佇","体":"體","余":"餘","佣":"傭","佥":"僉","侠":"俠","侣":"侶","侥":"僥","侦":"偵","侧":"側","侨":"僑","侩":"儈","侪":"儕","侬":"儂","侭":"儘","俣":"俁","俦":"儔","俨":"儼","俩":"倆","俪":"儷","俫":"倈","俭":"儉","债":"債","倾":"傾","偬":"傯","偻":"僂","偾":"僨","偿":"償","傤":"儎","傥":"儻","傧":"儐","储":"儲","傩":"儺","儿":"兒","兑":"兌","兖":"兗","党":"黨","兰":"蘭","关":"關","兴":"興","兹":"茲","养":"養","兽":"獸","冁":"囅","内":"內","冈":"岡","册":"冊","写":"寫","军":"軍","农":"農","冯":"馮","冲":"衝","决":"決","况":"況","冻":"凍","净":"淨","凄":"悽","准":"準","凉":"涼","减":"減","凑":"湊","凛":"凜","几":"幾","凤":"鳳","凫":"鳧","凭":"憑","凯":"凱","凶":"兇","击":"擊","凿":"鑿","刍":"芻","划":"劃","刘":"劉","则":"則","刚":"剛","创":"創","删":"刪","别":"別","刬":"剗","刭":"剄","刹":"剎","刽":"劊","刾":"㓨","刿":"劌","剀":"剴","剂":"劑","剐":"剮","剑":"劍","剥":"剝","剧":"劇","劝":"勸","办":"辦","务":"務","劢":"勱","动":"動","励":"勵","劲":"勁","劳":"勞","势":"勢","勋":"勳","勚":"勩","匀":"勻","匦":"匭","匮":"匱","区":"區","医":"醫","华":"華","协":"協","单":"單","卖":"賣","占":"佔","卢":"盧","卤":"滷","卧":"臥","卫":"衛","却":"卻","卺":"巹","厂":"廠","厅":"廳","历":"歷","厉":"厲","压":"壓","厌":"厭","厍":"厙","厐":"龎","厕":"廁","厘":"釐","厢":"廂","厣":"厴","厦":"廈","厨":"廚","厩":"廄","厮":"廝","县":"縣","叁":"叄","参":"參","叆":"靉","叇":"靆","双":"雙","发":"發","变":"變","叙":"敘","叠":"疊","台":"臺","叶":"葉","号":"號","叹":"嘆","叽":"嘰","吁":"籲","后":"後","吓":"嚇","吕":"呂","吗":"嗎","吨":"噸","听":"聽","启":"啟","吴":"吳","呐":"吶","呒":"嘸","呓":"囈","呕":"嘔","呖":"嚦","呗":"唄","员":"員","呙":"咼","呛":"嗆","呜":"嗚","咏":"詠","咙":"嚨","咛":"嚀","咝":"噝","咤":"吒","咨":"諮","咸":"鹹","响":"響","哑":"啞","哒":"噠","哓":"嘵","哔":"嗶","哕":"噦","哗":"譁","哙":"噲","哜":"嚌","哝":"噥","哟":"喲","唛":"嘜","唝":"嗊","唠":"嘮","唡":"啢","唢":"嗩","唤":"喚","啧":"嘖","啬":"嗇","啭":"囀","啮":"齧","啯":"嘓","啰":"囉","啴":"嘽","啸":"嘯","喷":"噴","喽":"嘍","喾":"嚳","嗫":"囁","嗳":"噯","嘘":"噓","嘤":"嚶","嘱":"囑","噜":"嚕","嚣":"囂","团":"團","园":"園","囱":"囪","围":"圍","囵":"圇","国":"國","图":"圖","圆":"圓","圣":"聖","圹":"壙","场":"場","坏":"壞","块":"塊","坚":"堅","坛":"壇","坜":"壢","坝":"壩","坞":"塢","坟":"墳","坠":"墜","垄":"壟","垅":"壠","垆":"壚","垒":"壘","垦":"墾","垩":"堊","垫":"墊","垭":"埡","垯":"墶","垱":"壋","垲":"塏","垴":"堖","埘":"塒","埙":"壎","埚":"堝","堑":"塹","堕":"墮","塆":"壪","墙":"牆","壮":"壯","声":"聲","壳":"殼","壶":"壺","壸":"壼","处":"處","备":"備","复":"復","够":"夠","头":"頭","夸":"誇","夹":"夾","夺":"奪","奁":"奩","奂":"奐","奋":"奮","奖":"獎","奥":"奧","妆":"妝","妇":"婦","妈":"媽","妩":"嫵","妪":"嫗","妫":"媯","姗":"姍","姹":"奼","娄":"婁","娅":"婭","娆":"嬈","娇":"嬌","娈":"孌","娱":"娛","娲":"媧","娴":"嫻","婳":"嫿","婴":"嬰","婵":"嬋","婶":"嬸","媪":"媼","媭":"嬃","嫒":"嬡","嫔":"嬪","嫱":"嬙","嬷":"嬤","孙":"孫","学":"學","孪":"孿","宁":"寧","宝":"寶","实":"實","宠":"寵","审":"審","宪":"憲","宫":"宮","宽":"寬","宾":"賓","寝":"寢","对":"對","寻":"尋","导":"導","寿":"壽","将":"將","尔":"爾","尘":"塵","尝":"嘗","尧":"堯","尴":"尷","尸":"屍","尽":"盡","层":"層","屃":"屓","屉":"屜","届":"屆","属":"屬","屡":"屢","屦":"屨","屿":"嶼","岁":"歲","岂":"豈","岖":"嶇","岗":"崗","岘":"峴","岚":"嵐","岛":"島","岩":"巖","岭":"嶺","岳":"嶽","岽":"崬","岿":"巋","峃":"嶨","峄":"嶧","峡":"峽","峣":"嶢","峤":"嶠","峥":"崢","峦":"巒","崂":"嶗","崃":"崍","崄":"嶮","崭":"嶄","嵘":"嶸","嵚":"嶔","嵝":"嶁","巅":"巔","巩":"鞏","巯":"巰","币":"幣","帅":"帥","师":"師","帏":"幃","帐":"帳","帘":"簾","帜":"幟","带":"帶","帧":"幀","帮":"幫","帱":"幬","帻":"幘","帼":"幗","幂":"冪","干":"幹","并":"並","广":"廣","庄":"莊","庆":"慶","庐":"廬","庑":"廡","库":"庫","应":"應","庙":"廟","庞":"龐","废":"廢","庼":"廎","廪":"廩","开":"開","异":"異","弃":"棄","弑":"弒","张":"張","弥":"彌","弪":"弳","弯":"彎","弹":"彈","强":"強","归":"歸","当":"當","录":"錄","彟":"彠","彦":"彥","彨":"彲","彻":"徹","征":"徵","径":"徑","徕":"徠","忆":"憶","忏":"懺","忧":"憂","忾":"愾","怀":"懷","态":"態","怂":"慫","怃":"憮","怄":"慪","怅":"悵","怆":"愴","怜":"憐","总":"總","怼":"懟","怿":"懌","恋":"戀","恒":"恆","恳":"懇","恶":"惡","恸":"慟","恹":"懨","恺":"愷","恻":"惻","恼":"惱","恽":"惲","悦":"悅","悫":"愨","悬":"懸","悭":"慳","悮":"悞","悯":"憫","惊":"驚","惧":"懼","惨":"慘","惩":"懲","惫":"憊","惬":"愜","惭":"慚","惮":"憚","惯":"慣","愠":"慍","愤":"憤","愦":"憒","愿":"願","慑":"懾","慭":"憖","懑":"懣","懒":"懶","懔":"懍","戆":"戇","戋":"戔","戏":"戲","戗":"戧","战":"戰","戬":"戩","戯":"戱","户":"戶","扑":"撲","托":"託","执":"執","扩":"擴","扪":"捫","扫":"掃","扬":"揚","扰":"擾","抚":"撫","抛":"拋","抟":"摶","抠":"摳","抡":"掄","抢":"搶","护":"護","报":"報","担":"擔","拟":"擬","拢":"攏","拣":"揀","拥":"擁","拦":"攔","拧":"擰","拨":"撥","择":"擇","挂":"掛","挚":"摯","挛":"攣","挜":"掗","挝":"撾","挞":"撻","挟":"挾","挠":"撓","挡":"擋","挢":"撟","挣":"掙","挤":"擠","挥":"揮","挦":"撏","捝":"挩","捞":"撈","损":"損","捡":"撿","换":"換","捣":"搗","据":"據","掳":"擄","掴":"摑","掷":"擲","掸":"撣","掺":"摻","掼":"摜","揽":"攬","揾":"搵","揿":"撳","搀":"攙","搁":"擱","搂":"摟","搄":"揯","搅":"攪","携":"攜","摄":"攝","摅":"攄","摆":"擺","摇":"搖","摈":"擯","摊":"攤","撄":"攖","撑":"撐","撵":"攆","撷":"擷","撸":"擼","撺":"攛","擜":"㩵","擞":"擻","攒":"攢","敌":"敵","敚":"敓","敛":"斂","敩":"斆","数":"數","斋":"齋","斓":"斕","斗":"鬥","斩":"斬","断":"斷","无":"無","旧":"舊","时":"時","旷":"曠","旸":"暘","昙":"曇","昵":"暱","昼":"晝","昽":"曨","显":"顯","晋":"晉","晒":"曬","晓":"曉","晔":"曄","晕":"暈","晖":"暉","暂":"暫","暅":"𣈶","暧":"曖","术":"術","朴":"樸","机":"機","杀":"殺","杂":"雜","权":"權","杠":"槓","条":"條","来":"來","杨":"楊","杩":"榪","杰":"傑","极":"極","构":"構","枞":"樅","枢":"樞","枣":"棗","枥":"櫪","枧":"梘","枨":"棖","枪":"槍","枫":"楓","枭":"梟","柜":"櫃","柠":"檸","柽":"檉","栀":"梔","栅":"柵","标":"標","栈":"棧","栉":"櫛","栊":"櫳","栋":"棟","栌":"櫨","栎":"櫟","栏":"欄","树":"樹","栖":"棲","栗":"慄","样":"樣","栾":"欒","桠":"椏","桡":"橈","桢":"楨","档":"檔","桤":"榿","桥":"橋","桦":"樺","桧":"檜","桨":"槳","桩":"樁","桪":"樳","梦":"夢","梼":"檮","梾":"棶","梿":"槤","检":"檢","棁":"梲","棂":"欞","椁":"槨","椝":"槼","椟":"櫝","椠":"槧","椢":"槶","椤":"欏","椫":"樿","椭":"橢","椮":"槮","楼":"樓","榄":"欖","榅":"榲","榇":"櫬","榈":"櫚","榉":"櫸","榝":"樧","槚":"檟","槛":"檻","槟":"檳","槠":"櫧","横":"橫","樯":"檣","樱":"櫻","橥":"櫫","橱":"櫥","橹":"櫓","橼":"櫞","檩":"檁","欢":"歡","欤":"歟","欧":"歐","歼":"殲","殁":"歿","殇":"殤","残":"殘","殒":"殞","殓":"殮","殚":"殫","殡":"殯","殴":"毆","毁":"毀","毂":"轂","毕":"畢","毙":"斃","毡":"氈","毵":"毿","毶":"𣯶","氇":"氌","气":"氣","氢":"氫","氩":"氬","氲":"氳","汇":"匯","汉":"漢","汤":"湯","汹":"洶","沄":"澐","沟":"溝","没":"沒","沣":"灃","沤":"漚","沥":"瀝","沦":"淪","沧":"滄","沨":"渢","沩":"溈","沪":"滬","泞":"濘","泪":"淚","泶":"澩","泷":"瀧","泸":"瀘","泺":"濼","泻":"瀉","泼":"潑","泽":"澤","泾":"涇","洁":"潔","洒":"灑","洼":"窪","浃":"浹","浅":"淺","浆":"漿","浇":"澆","浈":"湞","浉":"溮","浊":"濁","测":"測","浍":"澮","济":"濟","浏":"瀏","浐":"滻","浑":"渾","浒":"滸","浓":"濃","浔":"潯","浕":"濜","涂":"塗","涌":"湧","涚":"涗","涛":"濤","涝":"澇","涞":"淶","涟":"漣","涠":"潿","涡":"渦","涢":"溳","涣":"渙","涤":"滌","润":"潤","涧":"澗","涨":"漲","涩":"澀","淀":"澱","渊":"淵","渌":"淥","渍":"漬","渎":"瀆","渐":"漸","渑":"澠","渔":"漁","渖":"瀋","渗":"滲","温":"溫","游":"遊","湾":"灣","湿":"溼","溁":"濚","溃":"潰","溅":"濺","溆":"漵","溇":"漊","滗":"潷","滚":"滾","滞":"滯","滟":"灩","滠":"灄","满":"滿","滢":"瀅","滤":"濾","滥":"濫","滦":"灤","滨":"濱","滩":"灘","滪":"澦","潆":"瀠","潇":"瀟","潋":"瀲","潍":"濰","潜":"潛","潴":"瀦","澛":"瀂","澜":"瀾","濑":"瀨","濒":"瀕","灏":"灝","灭":"滅","灯":"燈","灵":"靈","灾":"災","灿":"燦","炀":"煬","炉":"爐","炖":"燉","炜":"煒","炝":"熗","点":"點","炼":"煉","炽":"熾","烁":"爍","烂":"爛","烃":"烴","烛":"燭","烟":"煙","烦":"煩","烧":"燒","烨":"燁","烩":"燴","烫":"燙","烬":"燼","热":"熱","焕":"煥","焖":"燜","焘":"燾","煴":"熅","熏":"燻","爱":"愛","爷":"爺","牍":"牘","牦":"犛","牵":"牽","牺":"犧","犊":"犢","状":"狀","犷":"獷","犸":"獁","犹":"猶","狈":"狽","狝":"獮","狞":"獰","独":"獨","狭":"狹","狮":"獅","狯":"獪","狰":"猙","狱":"獄","狲":"猻","猃":"獫","猎":"獵","猕":"獼","猡":"玀","猪":"豬","猫":"貓","猬":"蝟","献":"獻","獭":"獺","玑":"璣","玙":"璵","玚":"瑒","玛":"瑪","玮":"瑋","环":"環","现":"現","玱":"瑲","玺":"璽","珐":"琺","珑":"瓏","珰":"璫","珲":"琿","琎":"璡","琏":"璉","琐":"瑣","琼":"瓊","瑶":"瑤","瑷":"璦","瑸":"璸","璎":"瓔","瓒":"瓚","瓮":"甕","瓯":"甌","电":"電","画":"畫","畅":"暢","畴":"疇","疖":"癤","疗":"療","疟":"瘧","疠":"癘","疡":"瘍","疬":"癧","疭":"瘲","疮":"瘡","疯":"瘋","疱":"皰","疴":"痾","痈":"癰","痉":"痙","痒":"癢","痖":"瘂","痨":"癆","痪":"瘓","痫":"癇","瘅":"癉","瘆":"瘮","瘗":"瘞","瘘":"瘻","瘪":"癟","瘫":"癱","瘾":"癮","瘿":"癭","癞":"癩","癣":"癬","癫":"癲","皑":"皚","皱":"皺","皲":"皸","盏":"盞","盐":"鹽","监":"監","盖":"蓋","盗":"盜","盘":"盤","眍":"瞘","眦":"眥","眬":"矓","睁":"睜","睐":"睞","睑":"瞼","瞆":"瞶","瞒":"瞞","瞩":"矚","矫":"矯","矶":"磯","矾":"礬","矿":"礦","砀":"碭","码":"碼","砖":"磚","砗":"硨","砚":"硯","砜":"碸","砺":"礪","砻":"礱","砾":"礫","础":"礎","硁":"硜","硕":"碩","硖":"硤","硗":"磽","硙":"磑","硚":"礄","确":"確","硵":"磠","硷":"礆","碍":"礙","碛":"磧","碜":"磣","碱":"鹼","礼":"禮","祃":"禡","祎":"禕","祢":"禰","祯":"禎","祷":"禱","祸":"禍","禀":"稟","禄":"祿","禅":"禪","离":"離","秃":"禿","秆":"稈","种":"種","积":"積","称":"稱","秽":"穢","秾":"穠","稆":"穭","税":"稅","稣":"穌","稳":"穩","穑":"穡","穞":"穭","穷":"窮","窃":"竊","窍":"竅","窎":"窵","窑":"窯","窜":"竄","窝":"窩","窥":"窺","窦":"竇","窭":"窶","竖":"豎","竞":"競","笃":"篤","笋":"筍","笔":"筆","笕":"筧","笺":"箋","笼":"籠","笾":"籩","筑":"築","筚":"篳","筛":"篩","筜":"簹","筝":"箏","筹":"籌","筼":"篔","签":"籤","筿":"篠","简":"簡","箓":"籙","箦":"簀","箧":"篋","箨":"籜","箩":"籮","箪":"簞","箫":"簫","篑":"簣","篓":"簍","篮":"籃","篯":"籛","篱":"籬","簖":"籪","籁":"籟","籴":"糴","类":"類","籼":"秈","粜":"糶","粝":"糲","粤":"粵","粪":"糞","粮":"糧","糁":"糝","糇":"餱","糍":"餈","紧":"緊","絷":"縶","緼":"縕","縆":"緪","纟":"糹","纠":"糾","纡":"紆","红":"紅","纣":"紂","纤":"纖","纥":"紇","约":"約","级":"級","纨":"紈","纩":"纊","纪":"紀","纫":"紉","纬":"緯","纭":"紜","纮":"紘","纯":"純","纰":"紕","纱":"紗","纲":"綱","纳":"納","纴":"紝","纵":"縱","纶":"綸","纷":"紛","纸":"紙","纹":"紋","纺":"紡","纻":"紵","纼":"紖","纽":"紐","纾":"紓","线":"線","绀":"紺","绁":"紲","绂":"紱","练":"練","组":"組","绅":"紳","细":"細","织":"織","终":"終","绉":"縐","绊":"絆","绋":"紼","绌":"絀","绍":"紹","绎":"繹","经":"經","绐":"紿","绑":"綁","绒":"絨","结":"結","绔":"絝","绕":"繞","绖":"絰","绗":"絎","绘":"繪","给":"給","绚":"絢","绛":"絳","络":"絡","绝":"絕","绞":"絞","统":"統","绠":"綆","绡":"綃","绢":"絹","绣":"繡","绤":"綌","绥":"綏","绦":"絛","继":"繼","绨":"綈","绩":"績","绪":"緒","绫":"綾","绬":"緓","续":"續","绮":"綺","绯":"緋","绰":"綽","绱":"鞝","绲":"緄","绳":"繩","维":"維","绵":"綿","绶":"綬","绷":"繃","绸":"綢","绹":"綯","绺":"綹","绻":"綣","综":"綜","绽":"綻","绾":"綰","绿":"綠","缀":"綴","缁":"緇","缂":"緙","缃":"緗","缄":"緘","缅":"緬","缆":"纜","缇":"緹","缈":"緲","缉":"緝","缊":"縕","缋":"繢","缌":"緦","缍":"綞","缎":"緞","缏":"緶","缐":"線","缑":"緱","缒":"縋","缓":"緩","缔":"締","缕":"縷","编":"編","缗":"緡","缘":"緣","缙":"縉","缚":"縛","缛":"縟","缜":"縝","缝":"縫","缞":"縗","缟":"縞","缠":"纏","缡":"縭","缢":"縊","缣":"縑","缤":"繽","缥":"縹","缦":"縵","缧":"縲","缨":"纓","缩":"縮","缪":"繆","缫":"繅","缬":"纈","缭":"繚","缮":"繕","缯":"繒","缰":"韁","缱":"繾","缲":"繰","缳":"繯","缴":"繳","缵":"纘","罂":"罌","网":"網","罗":"羅","罚":"罰","罢":"罷","罴":"羆","羁":"羈","羟":"羥","羡":"羨","翘":"翹","翙":"翽","翚":"翬","耢":"耮","耧":"耬","耸":"聳","耻":"恥","聂":"聶","聋":"聾","职":"職","聍":"聹","联":"聯","聩":"聵","聪":"聰","肃":"肅","肠":"腸","肤":"膚","肮":"骯","肴":"餚","肾":"腎","肿":"腫","胀":"脹","胁":"脅","胆":"膽","胜":"勝","胧":"朧","胨":"腖","胪":"臚","胫":"脛","胶":"膠","脉":"脈","脍":"膾","脏":"髒","脐":"臍","脑":"腦","脓":"膿","脔":"臠","脚":"腳","脱":"脫","脶":"腡","脸":"臉","腊":"臘","腌":"醃","腘":"膕","腭":"顎","腻":"膩","腼":"靦","腽":"膃","腾":"騰","膑":"臏","膻":"羶","臜":"臢","舆":"輿","舣":"艤","舰":"艦","舱":"艙","舻":"艫","艰":"艱","艳":"豔","艺":"藝","节":"節","芈":"羋","芗":"薌","芜":"蕪","芦":"蘆","苁":"蓯","苇":"葦","苈":"藶","苋":"莧","苌":"萇","苍":"蒼","苎":"苧","苏":"蘇","苧":"薴","苹":"蘋","范":"範","茎":"莖","茏":"蘢","茑":"蔦","茔":"塋","茕":"煢","茧":"繭","荆":"荊","荐":"薦","荙":"薘","荚":"莢","荛":"蕘","荜":"蓽","荝":"萴","荞":"蕎","荟":"薈","荠":"薺","荡":"蕩","荣":"榮","荤":"葷","荥":"滎","荦":"犖","荧":"熒","荨":"蕁","荩":"藎","荪":"蓀","荫":"蔭","荬":"蕒","荭":"葒","荮":"葤","药":"藥","莅":"蒞","莱":"萊","莲":"蓮","莳":"蒔","莴":"萵","莶":"薟","获":"獲","莸":"蕕","莹":"瑩","莺":"鶯","莼":"蓴","萚":"蘀","萝":"蘿","萤":"螢","营":"營","萦":"縈","萧":"蕭","萨":"薩","葱":"蔥","蒀":"蒕","蒇":"蕆","蒉":"蕢","蒋":"蔣","蒌":"蔞","蒏":"醟","蓝":"藍","蓟":"薊","蓠":"蘺","蓣":"蕷","蓥":"鎣","蓦":"驀","蔂":"虆","蔷":"薔","蔹":"蘞","蔺":"藺","蔼":"藹","蕰":"薀","蕲":"蘄","蕴":"蘊","薮":"藪","藓":"蘚","藴":"蘊","蘖":"櫱","虏":"虜","虑":"慮","虚":"虛","虫":"蟲","虬":"虯","虮":"蟣","虱":"蝨","虽":"雖","虾":"蝦","虿":"蠆","蚀":"蝕","蚁":"蟻","蚂":"螞","蚃":"蠁","蚕":"蠶","蚝":"蠔","蚬":"蜆","蛊":"蠱","蛎":"蠣","蛏":"蟶","蛮":"蠻","蛰":"蟄","蛱":"蛺","蛲":"蟯","蛳":"螄","蛴":"蠐","蜕":"蛻","蜗":"蝸","蜡":"蠟","蝇":"蠅","蝈":"蟈","蝉":"蟬","蝎":"蠍","蝼":"螻","蝾":"蠑","螀":"螿","螨":"蟎","蟏":"蠨","衅":"釁","衔":"銜","补":"補","衬":"襯","衮":"袞","袄":"襖","袅":"嫋","袆":"褘","袜":"襪","袭":"襲","袯":"襏","装":"裝","裆":"襠","裈":"褌","裢":"褳","裣":"襝","裤":"褲","裥":"襉","褛":"褸","褴":"襤","襕":"襴","见":"見","观":"觀","觃":"覎","规":"規","觅":"覓","视":"視","觇":"覘","览":"覽","觉":"覺","觊":"覬","觋":"覡","觌":"覿","觍":"覥","觎":"覦","觏":"覯","觐":"覲","觑":"覷","觞":"觴","触":"觸","觯":"觶","訚":"誾","詟":"讋","誉":"譽","誊":"謄","讠":"訁","计":"計","订":"訂","讣":"訃","认":"認","讥":"譏","讦":"訐","讧":"訌","讨":"討","让":"讓","讪":"訕","讫":"訖","讬":"託","训":"訓","议":"議","讯":"訊","记":"記","讱":"訒","讲":"講","讳":"諱","讴":"謳","讵":"詎","讶":"訝","讷":"訥","许":"許","讹":"訛","论":"論","讻":"訩","讼":"訟","讽":"諷","设":"設","访":"訪","诀":"訣","证":"證","诂":"詁","诃":"訶","评":"評","诅":"詛","识":"識","诇":"詗","诈":"詐","诉":"訴","诊":"診","诋":"詆","诌":"謅","词":"詞","诎":"詘","诏":"詔","诐":"詖","译":"譯","诒":"詒","诓":"誆","诔":"誄","试":"試","诖":"詿","诗":"詩","诘":"詰","诙":"詼","诚":"誠","诛":"誅","诜":"詵","话":"話","诞":"誕","诟":"詬","诠":"詮","诡":"詭","询":"詢","诣":"詣","诤":"諍","该":"該","详":"詳","诧":"詫","诨":"諢","诩":"詡","诪":"譸","诫":"誡","诬":"誣","语":"語","诮":"誚","误":"誤","诰":"誥","诱":"誘","诲":"誨","诳":"誑","说":"說","诵":"誦","诶":"誒","请":"請","诸":"諸","诹":"諏","诺":"諾","读":"讀","诼":"諑","诽":"誹","课":"課","诿":"諉","谀":"諛","谁":"誰","谂":"諗","调":"調","谄":"諂","谅":"諒","谆":"諄","谇":"誶","谈":"談","谉":"讅","谊":"誼","谋":"謀","谌":"諶","谍":"諜","谎":"謊","谏":"諫","谐":"諧","谑":"謔","谒":"謁","谓":"謂","谔":"諤","谕":"諭","谖":"諼","谗":"讒","谘":"諮","谙":"諳","谚":"諺","谛":"諦","谜":"謎","谝":"諞","谞":"諝","谟":"謨","谠":"讜","谡":"謖","谢":"謝","谣":"謠","谤":"謗","谥":"諡","谦":"謙","谧":"謐","谨":"謹","谩":"謾","谪":"謫","谫":"譾","谬":"謬","谭":"譚","谮":"譖","谯":"譙","谰":"讕","谱":"譜","谲":"譎","谳":"讞","谴":"譴","谵":"譫","谶":"讖","豮":"豶","贝":"貝","贞":"貞","负":"負","贠":"貟","贡":"貢","财":"財","责":"責","贤":"賢","败":"敗","账":"賬","货":"貨","质":"質","贩":"販","贪":"貪","贫":"貧","贬":"貶","购":"購","贮":"貯","贯":"貫","贰":"貳","贱":"賤","贲":"賁","贳":"貰","贴":"貼","贵":"貴","贶":"貺","贷":"貸","贸":"貿","费":"費","贺":"賀","贻":"貽","贼":"賊","贽":"贄","贾":"賈","贿":"賄","赀":"貲","赁":"賃","赂":"賂","赃":"贓","资":"資","赅":"賅","赆":"贐","赇":"賕","赈":"賑","赉":"賚","赊":"賒","赋":"賦","赌":"賭","赍":"齎","赎":"贖","赏":"賞","赐":"賜","赑":"贔","赒":"賙","赓":"賡","赔":"賠","赕":"賧","赖":"賴","赗":"賵","赘":"贅","赙":"賻","赚":"賺","赛":"賽","赜":"賾","赝":"贗","赞":"贊","赟":"贇","赠":"贈","赡":"贍","赢":"贏","赣":"贛","赪":"赬","赵":"趙","赶":"趕","趋":"趨","趱":"趲","趸":"躉","跃":"躍","跄":"蹌","跖":"蹠","跞":"躒","践":"踐","跶":"躂","跷":"蹺","跸":"蹕","跹":"躚","跻":"躋","踌":"躊","踪":"蹤","踬":"躓","踯":"躑","蹑":"躡","蹒":"蹣","蹰":"躕","蹿":"躥","躏":"躪","躜":"躦","躯":"軀","輼":"轀","车":"車","轧":"軋","轨":"軌","轩":"軒","轪":"軑","轫":"軔","转":"轉","轭":"軛","轮":"輪","软":"軟","轰":"轟","轱":"軲","轲":"軻","轳":"轤","轴":"軸","轵":"軹","轶":"軼","轷":"軤","轸":"軫","轹":"轢","轺":"軺","轻":"輕","轼":"軾","载":"載","轾":"輊","轿":"轎","辀":"輈","辁":"輇","辂":"輅","较":"較","辄":"輒","辅":"輔","辆":"輛","辇":"輦","辈":"輩","辉":"輝","辊":"輥","辋":"輞","辌":"輬","辍":"輟","辎":"輜","辏":"輳","辐":"輻","辑":"輯","辒":"轀","输":"輸","辔":"轡","辕":"轅","辖":"轄","辗":"輾","辘":"轆","辙":"轍","辚":"轔","辞":"辭","辟":"闢","辩":"辯","辫":"辮","边":"邊","辽":"遼","达":"達","迁":"遷","过":"過","迈":"邁","运":"運","还":"還","这":"這","进":"進","远":"遠","违":"違","连":"連","迟":"遲","迩":"邇","迳":"逕","迹":"跡","适":"適","选":"選","逊":"遜","递":"遞","逦":"邐","逻":"邏","遗":"遺","遥":"遙","邓":"鄧","邝":"鄺","邬":"鄔","邮":"郵","邹":"鄒","邺":"鄴","邻":"鄰","郁":"鬱","郏":"郟","郐":"鄶","郑":"鄭","郓":"鄆","郦":"酈","郧":"鄖","郸":"鄲","酂":"酇","酝":"醞","酦":"醱","酱":"醬","酽":"釅","酾":"釃","酿":"釀","醖":"醞","采":"採","释":"釋","里":"裡","鉴":"鑑","銮":"鑾","錾":"鏨","钅":"釒","钆":"釓","钇":"釔","针":"針","钉":"釘","钊":"釗","钋":"釙","钌":"釕","钍":"釷","钎":"釺","钏":"釧","钐":"釤","钑":"鈒","钒":"釩","钓":"釣","钔":"鍆","钕":"釹","钖":"鍚","钗":"釵","钘":"鈃","钙":"鈣","钚":"鈈","钛":"鈦","钜":"鉅","钝":"鈍","钞":"鈔","钟":"鍾","钠":"鈉","钡":"鋇","钢":"鋼","钣":"鈑","钤":"鈐","钥":"鑰","钦":"欽","钧":"鈞","钨":"鎢","钩":"鉤","钪":"鈧","钫":"鈁","钬":"鈥","钭":"鈄","钮":"鈕","钯":"鈀","钰":"鈺","钱":"錢","钲":"鉦","钳":"鉗","钴":"鈷","钵":"缽","钶":"鈳","钷":"鉕","钸":"鈽","钹":"鈸","钺":"鉞","钻":"鑽","钼":"鉬","钽":"鉭","钾":"鉀","钿":"鈿","铀":"鈾","铁":"鐵","铂":"鉑","铃":"鈴","铄":"鑠","铅":"鉛","铆":"鉚","铇":"鉋","铈":"鈰","铉":"鉉","铊":"鉈","铋":"鉍","铌":"鈮","铍":"鈹","铎":"鐸","铏":"鉶","铐":"銬","铑":"銠","铒":"鉺","铓":"鋩","铔":"錏","铕":"銪","铖":"鋮","铗":"鋏","铘":"鋣","铙":"鐃","铚":"銍","铛":"鐺","铜":"銅","铝":"鋁","铞":"銱","铟":"銦","铠":"鎧","铡":"鍘","铢":"銖","铣":"銑","铤":"鋌","铥":"銩","铦":"銛","铧":"鏵","铨":"銓","铩":"鎩","铪":"鉿","铫":"銚","铬":"鉻","铭":"銘","铮":"錚","铯":"銫","铰":"鉸","铱":"銥","铲":"鏟","铳":"銃","铴":"鐋","铵":"銨","银":"銀","铷":"銣","铸":"鑄","铹":"鐒","铺":"鋪","铻":"鋙","铼":"錸","铽":"鋱","链":"鏈","铿":"鏗","销":"銷","锁":"鎖","锂":"鋰","锃":"鋥","锄":"鋤","锅":"鍋","锆":"鋯","锇":"鋨","锈":"鏽","锉":"銼","锊":"鋝","锋":"鋒","锌":"鋅","锍":"鋶","锎":"鐦","锏":"鐧","锐":"銳","锑":"銻","锒":"鋃","锓":"鋟","锔":"鋦","锕":"錒","锖":"錆","锗":"鍺","锘":"鍩","错":"錯","锚":"錨","锛":"錛","锜":"錡","锝":"鍀","锞":"錁","锟":"錕","锠":"錩","锡":"錫","锢":"錮","锣":"鑼","锤":"錘","锥":"錐","锦":"錦","锧":"鑕","锨":"鍁","锩":"錈","锪":"鍃","锫":"錇","锬":"錟","锭":"錠","键":"鍵","锯":"鋸","锰":"錳","锱":"錙","锲":"鍥","锳":"鍈","锴":"鍇","锵":"鏘","锶":"鍶","锷":"鍔","锸":"鍤","锹":"鍬","锺":"鍾","锻":"鍛","锼":"鎪","锽":"鍠","锾":"鍰","锿":"鎄","镀":"鍍","镁":"鎂","镂":"鏤","镃":"鎡","镄":"鐨","镅":"鎇","镆":"鏌","镇":"鎮","镈":"鎛","镉":"鎘","镊":"鑷","镋":"钂","镌":"鐫","镍":"鎳","镎":"鎿","镏":"鎦","镐":"鎬","镑":"鎊","镒":"鎰","镓":"鎵","镔":"鑌","镕":"鎔","镖":"鏢","镗":"鏜","镘":"鏝","镙":"鏍","镚":"鏰","镛":"鏞","镜":"鏡","镝":"鏑","镞":"鏃","镟":"鏇","镠":"鏐","镡":"鐔","镢":"钁","镣":"鐐","镤":"鏷","镥":"鑥","镦":"鐓","镧":"鑭","镨":"鐠","镩":"鑹","镪":"鏹","镫":"鐙","镬":"鑊","镭":"鐳","镮":"鐶","镯":"鐲","镰":"鐮","镱":"鐿","镲":"鑔","镳":"鑣","镴":"鑞","镵":"鑱","镶":"鑲","长":"長","门":"門","闩":"閂","闪":"閃","闫":"閆","闬":"閈","闭":"閉","问":"問","闯":"闖","闰":"閏","闱":"闈","闲":"閒","闳":"閎","间":"間","闵":"閔","闶":"閌","闷":"悶","闸":"閘","闹":"鬧","闺":"閨","闻":"聞","闼":"闥","闽":"閩","闾":"閭","闿":"闓","阀":"閥","阁":"閣","阂":"閡","阃":"閫","阄":"鬮","阅":"閱","阆":"閬","阇":"闍","阈":"閾","阉":"閹","阊":"閶","阋":"鬩","阌":"閿","阍":"閽","阎":"閻","阏":"閼","阐":"闡","阑":"闌","阒":"闃","阓":"闠","阔":"闊","阕":"闋","阖":"闔","阗":"闐","阘":"闒","阙":"闕","阚":"闞","阛":"闤","队":"隊","阳":"陽","阴":"陰","阵":"陣","阶":"階","际":"際","陆":"陸","陇":"隴","陈":"陳","陉":"陘","陕":"陝","陦":"隯","陧":"隉","陨":"隕","险":"險","随":"隨","隐":"隱","隶":"隸","隽":"雋","难":"難","雇":"僱","雏":"雛","雠":"讎","雳":"靂","雾":"霧","霁":"霽","霉":"黴","霡":"霢","霭":"靄","靓":"靚","靔":"靝","静":"靜","靥":"靨","鞑":"韃","鞒":"鞽","鞯":"韉","鞲":"韝","韦":"韋","韧":"韌","韨":"韍","韩":"韓","韪":"韙","韫":"韞","韬":"韜","韵":"韻","页":"頁","顶":"頂","顷":"頃","顸":"頇","项":"項","顺":"順","须":"須","顼":"頊","顽":"頑","顾":"顧","顿":"頓","颀":"頎","颁":"頒","颂":"頌","颃":"頏","预":"預","颅":"顱","领":"領","颇":"頗","颈":"頸","颉":"頡","颊":"頰","颋":"頲","颌":"頜","颍":"潁","颎":"熲","颏":"頦","颐":"頤","频":"頻","颒":"頮","颓":"頹","颔":"頷","颕":"頴","颖":"穎","颗":"顆","题":"題","颙":"顒","颚":"顎","颛":"顓","颜":"顏","额":"額","颞":"顳","颟":"顢","颠":"顛","颡":"顙","颢":"顥","颣":"纇","颤":"顫","颥":"顬","颦":"顰","颧":"顴","风":"風","飏":"颺","飐":"颭","飑":"颮","飒":"颯","飓":"颶","飔":"颸","飕":"颼","飖":"颻","飗":"飀","飘":"飄","飙":"飆","飚":"飈","飞":"飛","飨":"饗","餍":"饜","饣":"飠","饤":"飣","饥":"飢","饦":"飥","饧":"餳","饨":"飩","饩":"餼","饪":"飪","饫":"飫","饬":"飭","饭":"飯","饮":"飲","饯":"餞","饰":"飾","饱":"飽","饲":"飼","饳":"飿","饴":"飴","饵":"餌","饶":"饒","饷":"餉","饸":"餄","饹":"餎","饺":"餃","饻":"餏","饼":"餅","饽":"餑","饾":"餖","饿":"餓","馀":"餘","馁":"餒","馂":"餕","馃":"餜","馄":"餛","馅":"餡","馆":"館","馇":"餷","馈":"饋","馉":"餶","馊":"餿","馋":"饞","馌":"饁","馍":"饃","馎":"餺","馏":"餾","馐":"饈","馑":"饉","馒":"饅","馓":"饊","馔":"饌","馕":"饢","马":"馬","驭":"馭","驮":"馱","驯":"馴","驰":"馳","驱":"驅","驲":"馹","驳":"駁","驴":"驢","驵":"駔","驶":"駛","驷":"駟","驸":"駙","驹":"駒","驺":"騶","驻":"駐","驼":"駝","驽":"駑","驾":"駕","驿":"驛","骀":"駘","骁":"驍","骂":"罵","骃":"駰","骄":"驕","骅":"驊","骆":"駱","骇":"駭","骈":"駢","骉":"驫","骊":"驪","骋":"騁","验":"驗","骍":"騂","骎":"駸","骏":"駿","骐":"騏","骑":"騎","骒":"騍","骓":"騅","骔":"騌","骕":"驌","骖":"驂","骗":"騙","骘":"騭","骙":"騤","骚":"騷","骛":"騖","骜":"驁","骝":"騮","骞":"騫","骟":"騸","骠":"驃","骡":"騾","骢":"驄","骣":"驏","骤":"驟","骥":"驥","骦":"驦","骧":"驤","髅":"髏","髋":"髖","髌":"髕","鬓":"鬢","鬶":"鬹","魇":"魘","魉":"魎","鱼":"魚","鱽":"魛","鱾":"魢","鱿":"魷","鲀":"魨","鲁":"魯","鲂":"魴","鲃":"䰾","鲄":"魺","鲅":"鮁","鲆":"鮃","鲇":"鯰","鲈":"鱸","鲉":"鮋","鲊":"鮓","鲋":"鮒","鲌":"鮊","鲍":"鮑","鲎":"鱟","鲏":"鮍","鲐":"鮐","鲑":"鮭","鲒":"鮚","鲓":"鮳","鲔":"鮪","鲕":"鮞","鲖":"鮦","鲗":"鰂","鲘":"鮜","鲙":"鱠","鲚":"鱭","鲛":"鮫","鲜":"鮮","鲝":"鮺","鲞":"鯗","鲟":"鱘","鲠":"鯁","鲡":"鱺","鲢":"鰱","鲣":"鰹","鲤":"鯉","鲥":"鰣","鲦":"鰷","鲧":"鯀","鲨":"鯊","鲩":"鯇","鲪":"鮶","鲫":"鯽","鲬":"鯒","鲭":"鯖","鲮":"鯪","鲯":"鯕","鲰":"鯫","鲱":"鯡","鲲":"鯤","鲳":"鯧","鲴":"鯝","鲵":"鯢","鲶":"鯰","鲷":"鯛","鲸":"鯨","鲹":"鰺","鲺":"鯴","鲻":"鯔","鲼":"鱝","鲽":"鰈","鲾":"鰏","鲿":"鱨","鳀":"鯷","鳁":"鰮","鳂":"鰃","鳃":"鰓","鳄":"鱷","鳅":"鰍","鳆":"鰒","鳇":"鰉","鳈":"鰁","鳉":"鱂","鳊":"鯿","鳋":"鰠","鳌":"鰲","鳍":"鰭","鳎":"鰨","鳏":"鰥","鳐":"鰩","鳑":"鰟","鳒":"鰜","鳓":"鰳","鳔":"鰾","鳕":"鱈","鳖":"鱉","鳗":"鰻","鳘":"鰵","鳙":"鱅","鳚":"䲁","鳛":"鰼","鳜":"鱖","鳝":"鱔","鳞":"鱗","鳟":"鱒","鳠":"鱯","鳡":"鱤","鳢":"鱧","鳣":"鱣","鳤":"䲘","鸟":"鳥","鸠":"鳩","鸡":"雞","鸢":"鳶","鸣":"鳴","鸤":"鳲","鸥":"鷗","鸦":"鴉","鸧":"鶬","鸨":"鴇","鸩":"鴆","鸪":"鴣","鸫":"鶇","鸬":"鸕","鸭":"鴨","鸮":"鴞","鸯":"鴦","鸰":"鴒","鸱":"鴟","鸲":"鴝","鸳":"鴛","鸴":"鷽","鸵":"鴕","鸶":"鷥","鸷":"鷙","鸸":"鴯","鸹":"鴰","鸺":"鵂","鸻":"鴴","鸼":"鵃","鸽":"鴿","鸾":"鸞","鸿":"鴻","鹀":"鵐","鹁":"鵓","鹂":"鸝","鹃":"鵑","鹄":"鵠","鹅":"鵝","鹆":"鵒","鹇":"鷳","鹈":"鵜","鹉":"鵡","鹊":"鵲","鹋":"鶓","鹌":"鵪","鹍":"鵾","鹎":"鵯","鹏":"鵬","鹐":"鵮","鹑":"鶉","鹒":"鶊","鹓":"鵷","鹔":"鷫","鹕":"鶘","鹖":"鶡","鹗":"鶚","鹘":"鶻","鹙":"鶖","鹚":"鷀","鹛":"鶥","鹜":"鶩","鹝":"鷊","鹞":"鷂","鹟":"鶲","鹠":"鶹","鹡":"鶺","鹢":"鷁","鹣":"鶼","鹤":"鶴","鹥":"鷖","鹦":"鸚","鹧":"鷓","鹨":"鷚","鹩":"鷯","鹪":"鷦","鹫":"鷲","鹬":"鷸","鹭":"鷺","鹮":"䴉","鹯":"鸇","鹰":"鷹","鹱":"鸌","鹲":"鸏","鹳":"鸛","鹴":"鸘","鹾":"鹺","麦":"麥","麸":"麩","麹":"麴","麺":"麵","麽":"麼","黄":"黃","黉":"黌","黡":"黶","黩":"黷","黪":"黲","黾":"黽","鼋":"黿","鼌":"鼂","鼍":"鼉","鼹":"鼴","齐":"齊","齑":"齏","齿":"齒","龀":"齔","龁":"齕","龂":"齗","龃":"齟","龄":"齡","龅":"齙","龆":"齠","龇":"齜","龈":"齦","龉":"齬","龊":"齪","龋":"齲","龌":"齷","龙":"龍","龚":"龔","龛":"龕","龟":"龜","鿎":"䃮","鿏":"䥑","鿒":"鿓","鿔":"鎶","𠀾":"𠁞","𠆲":"儣","𠆿":"𠌥","𠇹":"俓","𠉂":"㒓","𠉗":"𠏢","𠋆":"儭","𠚳":"𠠎","𠛅":"剾","𠛆":"𠞆","𠛾":"𪟖","𠡠":"勑","𠮶":"嗰","𠯟":"哯","𠯠":"噅","𠰱":"㘉","𠰷":"嚧","𠱞":"囃","𠲥":"𡅏","𠴛":"𡃕","𠴢":"𡄔","𠵸":"𡄣","𠵾":"㗲","𡋀":"𡓾","𡋗":"𡑭","𡋤":"壗","𡍣":"𡔖","𡒄":"壈","𡝠":"㜷","𡞋":"㜗","𡞱":"㜢","𡠟":"孎","𡥧":"孻","𡭜":"𡮉","𡭬":"𡮣","𡳃":"𡳳","𡳒":"𦘧","𡶴":"嵼","𡸃":"𡽗","𡺃":"嶈","𡺄":"嶘","𢋈":"㢝","𢗓":"㦛","𢘙":"𢤱","𢘝":"𢣚","𢘞":"𢣭","𢙏":"愻","𢙐":"憹","𢙑":"𢠼","𢙒":"憢","𢙓":"懀","𢛯":"㦎","𢠁":"懎","𢢐":"𤢻","𢧐":"戰","𢫊":"𢷮","𢫞":"𢶫","𢫬":"摋","𢬍":"擫","𢬦":"𢹿","𢭏":"擣","𢽾":"斅","𣃁":"斸","𣆐":"曥","𣈣":"𣋋","𣍨":"𦢈","𣍯":"腪","𣍰":"脥","𣎑":"臗","𣏢":"槫","𣐕":"桱","𣐤":"欍","𣑶":"𣠲","𣒌":"楇","𣓿":"橯","𣔌":"樤","𣗊":"樠","𣗋":"欓","𣗙":"㰙","𣘐":"㯤","𣘓":"𣞻","𣘴":"檭","𣘷":"𣝕","𣚚":"欘","𣞎":"𣠩","𣨼":"殢","𣭤":"𣯴","𣯣":"𣯩","𣱝":"氭","𣲗":"湋","𣲘":"潕","𣳆":"㵗","𣶩":"澅","𣶫":"𣿉","𣶭":"𪷓","𣷷":"𤅶","𣸣":"濆","𣺼":"灙","𣺽":"𤁣","𣽷":"瀃","𤆡":"熓","𤆢":"㷍","𤇃":"爄","𤇄":"熌","𤇭":"爖","𤇹":"熚","𤈶":"熉","𤈷":"㷿","𤊀":"𤒎","𤊰":"𤓩","𤋏":"熡","𤎺":"𤓎","𤎻":"𤑳","𤙯":"𤛮","𤝢":"𤢟","𤞃":"獩","𤞤":"玁","𤠋":"㺏","𤦀":"瓕","𤩽":"瓛","𤳄":"𤳸","𤶊":"癐","𤶧":"𤸫","𤻊":"㿗","𤽯":"㿧","𤾀":"皟","𤿲":"麬","𥁢":"䀉","𥅘":"𥌃","𥅴":"䀹","𥅿":"𥊝","𥆧":"瞤","𥇢":"䁪","𥎝":"䂎","𥐟":"礒","𥐯":"𥖅","𥐰":"𥕥","𥐻":"碙","𥞦":"𥞵","𥧂":"𥨐","𥩟":"竚","𥩺":"𥪂","𥫣":"籅","𥬀":"䉙","𥬞":"籋","𥬠":"篘","𥭉":"𥵊","𥮋":"𥸠","𥮜":"䉲","𥮾":"篸","𥱔":"𥵃","𥹥":"𥼽","𥺅":"䊭","𥺇":"𥽖","𦈈":"𥿊","𦈉":"緷","𦈋":"綇","𦈌":"綀","𦈎":"繟","𦈏":"緍","𦈐":"縺","𦈑":"緸","𦈒":"𦂅","𦈓":"䋿","𦈔":"縎","𦈕":"緰","𦈖":"䌈","𦈗":"𦃄","𦈘":"䌋","𦈙":"䌰","𦈚":"縬","𦈛":"繓","𦈜":"䌖","𦈝":"繏","𦈞":"䌟","𦈟":"䌝","𦈠":"䌥","𦈡":"繻","𦍠":"䍽","𦛨":"朥","𦝼":"膢","𦟗":"𦣎","𦨩":"𦪽","𦰏":"蓧","𦰴":"䕳","𦶟":"爇","𦶻":"𦾟","𦻕":"蘟","𧉐":"𧕟","𧉞":"䗿","𧌥":"𧎈","𧏖":"蠙","𧏗":"蠀","𧑏":"蠾","𧒭":"𧔥","𧜭":"䙱","𧝝":"襰","𧝧":"𧟀","𧮪":"詀","𧳕":"𧳟","𧹑":"䞈","𧹒":"買","𧹓":"𧶔","𧹔":"賬","𧹕":"䝻","𧹖":"賟","𧹗":"贃","𧿈":"𨇁","𨀁":"躘","𨀱":"𨄣","𨁴":"𨅍","𨂺":"𨈊","𨄄":"𨈌","𨅛":"䠱","𨅫":"𨇞","𨅬":"躝","𨉗":"軉","𨐅":"軗","𨐆":"𨊻","𨐇":"𨏠","𨐈":"輄","𨐉":"𨎮","𨐊":"𨏥","𨑹":"䢨","𨟳":"𨣞","𨠨":"𨣧","𨡙":"𨢿","𨡺":"𨣈","𨤰":"𨤻","𨰾":"鎷","𨰿":"釳","𨱀":"𨥛","𨱁":"鈠","𨱂":"鈋","𨱃":"鈲","𨱄":"鈯","𨱅":"鉁","𨱆":"龯","𨱇":"銶","𨱈":"鋉","𨱉":"鍄","𨱊":"𨧱","𨱋":"錂","𨱌":"鏆","𨱍":"鎯","𨱎":"鍮","𨱏":"鎝","𨱐":"𨫒","𨱑":"鐄","𨱒":"鏉","𨱓":"鐎","𨱔":"鐏","𨱕":"𨮂","𨱖":"䥩","𨷿":"䦳","𨸀":"𨳕","𨸁":"𨳑","𨸂":"閍","𨸃":"閐","𨸄":"䦘","𨸅":"𨴗","𨸆":"𨵩","𨸇":"𨵸","𨸉":"𨶀","𨸊":"𨶏","𨸋":"𨶲","𨸌":"𨶮","𨸎":"𨷲","𨸘":"𨽏","𨸟":"䧢","𩏼":"䪏","𩏽":"𩏪","𩏾":"𩎢","𩏿":"䪘","𩐀":"䪗","𩓋":"顂","𩖕":"𩓣","𩖖":"顃","𩖗":"䫴","𩙥":"颰","𩙦":"𩗀","𩙧":"䬞","𩙨":"𩘹","𩙩":"𩘀","𩙪":"颷","𩙫":"颾","𩙬":"𩘺","𩙭":"𩘝","𩙮":"䬘","𩙯":"䬝","𩙰":"𩙈","𩟿":"𩚛","𩠀":"𩚥","𩠁":"𩚵","𩠂":"𩛆","𩠃":"𩛩","𩠅":"𩟐","𩠆":"𩜦","𩠇":"䭀","𩠈":"䭃","𩠉":"𩜇","𩠊":"𩜵","𩠋":"𩝔","𩠌":"餸","𩠎":"𩞄","𩠏":"𩞦","𩠠":"𩠴","𩡖":"𩡣","𩧦":"𩡺","𩧨":"駎","𩧩":"𩤊","𩧪":"䮾","𩧫":"駚","𩧬":"𩢡","𩧭":"䭿","𩧮":"𩢾","𩧯":"驋","𩧰":"䮝","𩧱":"𩥉","𩧲":"駧","𩧳":"𩢸","𩧴":"駩","𩧵":"𩢴","𩧶":"𩣏","𩧸":"𩣫","𩧺":"駶","𩧻":"𩣵","𩧼":"𩣺","𩧿":"䮠","𩨀":"騔","𩨁":"䮞","𩨂":"驄","𩨃":"騝","𩨄":"騪","𩨅":"𩤸","𩨆":"𩤙","𩨇":"䮫","𩨈":"騟","𩨉":"𩤲","𩨊":"騚","𩨋":"𩥄","𩨌":"𩥑","𩨍":"𩥇","𩨎":"龭","𩨏":"䮳","𩨐":"𩧆","𩩈":"䯤","𩬣":"𩭙","𩬤":"𩰀","𩭹":"鬖","𩯒":"𩯳","𩰰":"𩰹","𩲒":"𩳤","𩴌":"𩴵","𩽹":"魥","𩽺":"𩵩","𩽻":"𩵹","𩽼":"鯶","𩽽":"𩶱","𩽾":"鮟","𩽿":"𩶰","𩾁":"鯄","𩾂":"䲖","𩾃":"鮸","𩾄":"𩷰","𩾅":"𩸃","𩾆":"𩸦","𩾇":"鯱","𩾈":"䱙","𩾊":"䱬","𩾋":"䱰","𩾌":"鱇","𩾎":"𩽇","𪉂":"䲰","𪉃":"鳼","𪉄":"𩿪","𪉅":"𪀦","𪉆":"鴲","𪉈":"鴜","𪉉":"𪁈","𪉊":"鷨","𪉋":"𪀾","𪉌":"𪁖","𪉍":"鵚","𪉎":"𪂆","𪉏":"𪃏","𪉐":"𪃍","𪉑":"鷔","𪉒":"𪄕","𪉔":"𪄆","𪉕":"𪇳","𪎈":"䴬","𪎉":"麲","𪎊":"麨","𪎋":"䴴","𪎌":"麳","𪑅":"䵳","𪔭":"𪔵","𪚏":"𪘀","𪚐":"𪘯","𪜎":"𠿕","𪞝":"凙","𪟎":"㔋","𪟝":"勣","𪠀":"𧷎","𪠟":"㓄","𪠡":"𠬙","𪠳":"唓","𪠵":"㖮","𪠸":"嚛","𪠺":"𠽃","𪠽":"噹","𪡀":"嘺","𪡃":"嘪","𪡋":"噞","𪡏":"嗹","𪡛":"㗿","𪡞":"嘳","𪡺":"𡃄","𪢌":"㘓","𪢐":"𡃤","𪢒":"𡂡","𪢕":"嚽","𪢖":"𡅯","𪢠":"囒","𪢮":"圞","𪢸":"墲","𪣆":"埬","𪣒":"堚","𪣻":"塿","𪤄":"𡓁","𪤚":"壣","𪥠":"𧹈","𪥫":"孇","𪥰":"嬣","𪥿":"嬻","𪧀":"孾","𪧘":"寠","𪨊":"㞞","𪨗":"屩","𪨧":"崙","𪨩":"𡸗","𪨶":"輋","𪨷":"巗","𪨹":"𡹬","𪩇":"㟺","𪩎":"巊","𪩘":"巘","𪩛":"𡿖","𪩷":"幝","𪩸":"幩","𪪏":"廬","𪪑":"㢗","𪪞":"廧","𪪴":"𢍰","𪪼":"彃","𪫌":"徿","𪫡":"𢤩","𪫷":"㦞","𪫺":"憸","𪬚":"𢣐","𪬯":"𢤿","𪭝":"𢯷","𪭢":"摐","𪭧":"擟","𪭯":"𢶒","𪭵":"掚","𪭾":"撊","𪮃":"㨻","𪮋":"㩋","𪮖":"撧","𪮳":"𢺳","𪮶":"攋","𪯋":"㪎","𪰶":"曊","𪱥":"膹","𪱷":"梖","𪲎":"櫅","𪲔":"欐","𪲛":"檵","𪲮":"櫠","𪳍":"欇","𪳗":"𣜬","𪴙":"欑","𪵑":"毊","𪵣":"霼","𪵱":"濿","𪶄":"溡","𪶒":"𤄷","𪶮":"𣽏","𪷍":"㵾","𪷽":"灒","𪸕":"熂","𪸩":"煇","𪹀":"𤑹","𪹠":"𤓌","𪹳":"爥","𪹹":"𤒻","𪺣":"𤘀","𪺪":"𤜆","𪺭":"犞","𪺷":"獊","𪺸":"𤠮","𪺻":"㺜","𪺽":"猌","𪻐":"瑽","𪻨":"瓄","𪻲":"瑻","𪻺":"璝","𪼋":"㻶","𪼴":"𤬅","𪽈":"畼","𪽝":"𤳷","𪽪":"痮","𪽭":"𤷃","𪽮":"㿖","𪽴":"𤺔","𪽷":"瘱","𪾔":"盨","𪾢":"睍","𪾣":"眝","𪾦":"矑","𪾸":"矉","𪿊":"𥏝","𪿞":"𥖲","𪿫":"礮","𪿵":"𥗇","𫀌":"𥜰","𫀓":"𥜐","𫀨":"䅐","𫀬":"䅳","𫀮":"𥢷","𫁂":"䆉","𫁟":"竱","𫁡":"鴗","𫁱":"𥶽","𫁲":"䉑","𫁳":"𥯤","𫁷":"䉶","𫁺":"𥴼","𫂃":"簢","𫂆":"簂","𫂈":"䉬","𫂖":"𥴨","𫂿":"𥻦","𫃗":"𩏷","𫄙":"糺","𫄚":"䊺","𫄛":"紟","𫄜":"䋃","𫄝":"𥾯","𫄞":"䋔","𫄟":"絁","𫄠":"絙","𫄡":"絧","𫄢":"絥","𫄣":"繷","𫄤":"繨","𫄥":"纚","𫄦":"𦀖","𫄧":"綖","𫄨":"絺","𫄩":"䋦","𫄪":"𦅇","𫄫":"綟","𫄬":"緤","𫄭":"緮","𫄮":"䋼","𫄯":"𦃩","𫄰":"縍","𫄱":"繬","𫄲":"縸","𫄳":"縰","𫄴":"繂","𫄵":"𦅈","𫄶":"繈","𫄷":"繶","𫄸":"纁","𫄹":"纗","𫅅":"䍤","𫅗":"羵","𫅥":"𦒀","𫅭":"䎙","𫅼":"𦔖","𫆏":"聻","𫆝":"𦟼","𫆫":"𦡝","𫇘":"𦧺","𫇛":"艣","𫇪":"𦱌","𫇭":"蒍","𫇴":"蒭","𫇽":"蕽","𫈉":"蕳","𫈎":"葝","𫈟":"蔯","𫈵":"蕝","𫉁":"薆","𫉄":"藷","𫊪":"䗅","𫊮":"蠦","𫊸":"蟜","𫊹":"𧒯","𫊻":"蟳","𫋇":"蟂","𫋌":"蟘","𫋲":"䙔","𫋷":"襗","𫋹":"襓","𫋻":"襘","𫌀":"襀","𫌇":"襵","𫌋":"𧞫","𫌨":"覼","𫌪":"覛","𫌫":"𧡴","𫌬":"𧢄","𫌭":"覹","𫌯":"䚩","𫍐":"𧭹","𫍙":"訑","𫍚":"訞","𫍛":"訜","𫍜":"詓","𫍝":"諫","𫍞":"𧦝","𫍟":"𧦧","𫍠":"䛄","𫍡":"詑","𫍢":"譊","𫍣":"詷","𫍤":"譑","𫍥":"誂","𫍦":"譨","𫍧":"誺","𫍨":"誫","𫍩":"諣","𫍪":"誋","𫍫":"䛳","𫍬":"誷","𫍭":"𧩕","𫍮":"誳","𫍯":"諴","𫍰":"諰","𫍱":"諯","𫍲":"謏","𫍳":"諥","𫍴":"謱","𫍵":"謸","𫍶":"𧩼","𫍷":"謉","𫍸":"謆","𫍹":"謯","𫍺":"𧫝","𫍻":"譆","𫍼":"𧬤","𫍽":"譞","𫍾":"𧭈","𫍿":"譾","𫎆":"豵","𫎌":"貗","𫎦":"贚","𫎧":"䝭","𫎨":"𧸘","𫎩":"賝","𫎪":"䞋","𫎫":"贉","𫎬":"贑","𫎭":"䞓","𫎱":"䟐","𫎳":"䟆","𫎸":"𧽯","𫎺":"䟃","𫏃":"䠆","𫏆":"蹳","𫏋":"蹻","𫏌":"𨂐","𫏐":"蹔","𫏑":"𨇽","𫏕":"𨆪","𫏞":"𨇰","𫏨":"𨇤","𫐄":"軏","𫐅":"軕","𫐆":"轣","𫐇":"軜","𫐈":"軷","𫐉":"軨","𫐊":"軬","𫐋":"𨎌","𫐌":"軿","𫐍":"𨌈","𫐎":"輢","𫐏":"輖","𫐐":"輗","𫐑":"輨","𫐒":"輷","𫐓":"輮","𫐔":"𨍰","𫐕":"轊","𫐖":"轇","𫐗":"轐","𫐘":"轗","𫐙":"轠","𫐷":"遱","𫑘":"鄟","𫑡":"鄳","𫑷":"醶","𫓥":"釟","𫓦":"釨","𫓧":"鈇","𫓨":"鈛","𫓩":"鏦","𫓪":"鈆","𫓫":"𨥟","𫓬":"鉔","𫓭":"鉠","𫓮":"𨪕","𫓯":"銈","𫓰":"銊","𫓱":"鐈","𫓲":"銁","𫓳":"𨰋","𫓴":"鉾","𫓵":"鋠","𫓶":"鋗","𫓷":"𫒡","𫓸":"錽","𫓹":"錤","𫓺":"鐪","𫓻":"錜","𫓼":"𨨛","𫓽":"錝","𫓾":"錥","𫓿":"𨨢","𫔀":"鍊","𫔁":"鐼","𫔂":"鍉","𫔃":"𨰲","𫔄":"鍒","𫔅":"鎍","𫔆":"䥯","𫔇":"鎞","𫔈":"鎙","𫔉":"𨰃","𫔊":"鏥","𫔋":"䥗","𫔌":"鏾","𫔍":"鐇","𫔎":"鐍","𫔏":"𨬖","𫔐":"𨭸","𫔑":"𨭖","𫔒":"𨮳","𫔓":"𨯟","𫔔":"鑴","𫔕":"𨰥","𫔖":"𨲳","𫔭":"開","𫔮":"閒","𫔯":"閗","𫔰":"閞","𫔲":"𨴹","𫔴":"閵","𫔵":"䦯","𫔶":"闑","𫔽":"𨼳","𫕚":"𩀨","𫕥":"霣","𫕨":"𩅙","𫖃":"靧","𫖅":"䪊","𫖇":"鞾","𫖑":"𩎖","𫖒":"韠","𫖓":"𩏂","𫖔":"韛","𫖕":"韝","𫖖":"𩏠","𫖪":"𩑔","𫖫":"䪴","𫖬":"䪾","𫖭":"𩒎","𫖮":"顗","𫖯":"頫","𫖰":"䫂","𫖱":"䫀","𫖲":"䫟","𫖳":"頵","𫖴":"𩔳","𫖵":"𩓥","𫖶":"顅","𫖷":"𩔑","𫖸":"願","𫖹":"顣","𫖺":"䫶","𫗇":"䫻","𫗈":"𩗓","𫗉":"𩗴","𫗊":"䬓","𫗋":"飋","𫗚":"𩟗","𫗞":"飦","𫗟":"䬧","𫗠":"餦","𫗡":"𩚩","𫗢":"飵","𫗣":"飶","𫗤":"𩛌","𫗥":"餫","𫗦":"餔","𫗧":"餗","𫗨":"𩛡","𫗩":"饠","𫗪":"餧","𫗫":"餬","𫗬":"餪","𫗭":"餵","𫗮":"餭","𫗯":"餱","𫗰":"䭔","𫗱":"䭑","𫗳":"𩝽","𫗴":"饘","𫗵":"饟","𫘛":"馯","𫘜":"馼","𫘝":"駃","𫘞":"駞","𫘟":"駊","𫘠":"駤","𫘡":"駫","𫘣":"駻","𫘤":"騃","𫘥":"騉","𫘦":"騊","𫘧":"騄","𫘨":"騠","𫘩":"騜","𫘪":"騵","𫘫":"騴","𫘬":"騱","𫘭":"騻","𫘮":"䮰","𫘯":"驓","𫘰":"驙","𫘱":"驨","𫘽":"鬠","𫙂":"𩯁","𫚈":"鱮","𫚉":"魟","𫚊":"鰑","𫚋":"鱄","𫚌":"魦","𫚍":"魵","𫚎":"𩶁","𫚏":"䱁","𫚐":"䱀","𫚑":"鮅","𫚒":"鮄","𫚓":"鮤","𫚔":"鮰","𫚕":"鰤","𫚖":"鮆","𫚗":"鮯","𫚘":"𩻮","𫚙":"鯆","𫚚":"鮿","𫚛":"鮵","𫚜":"䲅","𫚝":"𩸄","𫚞":"鯬","𫚟":"𩸡","𫚠":"䱧","𫚡":"鯞","𫚢":"鰋","𫚣":"鯾","𫚤":"鰦","𫚥":"鰕","𫚦":"鰫","𫚧":"鰽","𫚨":"𩻗","𫚩":"𩻬","𫚪":"鱊","𫚫":"鱢","𫚬":"𩼶","𫚭":"鱲","𫛚":"鳽","𫛛":"鳷","𫛜":"鴀","𫛝":"鴅","𫛞":"鴃","𫛟":"鸗","𫛠":"𩿤","𫛡":"鴔","𫛢":"鸋","𫛣":"鴥","𫛤":"鴐","𫛥":"鵊","𫛦":"鴮","𫛧":"𪀖","𫛨":"鵧","𫛩":"鴳","𫛪":"鴽","𫛫":"鶰","𫛬":"䳜","𫛭":"鵟","𫛮":"䳤","𫛯":"鶭","𫛰":"䳢","𫛱":"鵫","𫛲":"鵰","𫛳":"鵩","𫛴":"鷤","𫛵":"鶌","𫛶":"鶒","𫛷":"鶦","𫛸":"鶗","𫛹":"𪃧","𫛺":"䳧","𫛻":"𪃒","𫛼":"䳫","𫛽":"鷅","𫛾":"𪆷","𫜀":"鷐","𫜁":"鷩","𫜂":"𪅂","𫜃":"鷣","𫜄":"鷷","𫜅":"䴋","𫜊":"𪉸","𫜑":"麷","𫜒":"䴱","𫜓":"𪌭","𫜔":"䴽","𫜕":"𪍠","𫜙":"䵴","𫜟":"𪓰","𫜨":"䶕","𫜩":"齧","𫜪":"齩","𫜫":"𫜦","𫜬":"齰","𫜭":"齭","𫜮":"齴","𫜯":"𪙏","𫜰":"齾","𫜲":"龓","𫜳":"䶲","𫝈":"㑮","𫝋":"𠐊","𫝦":"㛝","𫝧":"㜐","𫝨":"媈","𫝩":"嬦","𫝪":"𡟫","𫝫":"婡","𫝬":"嬇","𫝭":"孆","𫝮":"孄","𫝵":"嶹","𫞅":"𦠅","𫞗":"潣","𫞚":"澬","𫞛":"㶆","𫞝":"灍","𫞠":"爧","𫞡":"爃","𫞢":"𤛱","𫞣":"㹽","𫞥":"珼","𫞦":"璾","𫞧":"𤩂","𫞨":"璼","𫞩":"璊","𫞷":"𥢶","𫟃":"絍","𫟄":"綋","𫟅":"綡","𫟆":"緟","𫟇":"𦆲","𫟑":"䖅","𫟕":"䕤","𫟞":"訨","𫟟":"詊","𫟠":"譂","𫟡":"誴","𫟢":"䜖","𫟤":"䡐","𫟥":"䡩","𫟦":"䡵","𫟫":"𨞺","𫟬":"𨟊","𫟲":"釚","𫟳":"釲","𫟴":"鈖","𫟵":"鈗","𫟶":"銏","𫟷":"鉝","𫟸":"鉽","𫟹":"鉷","𫟺":"䤤","𫟻":"銂","𫟼":"鐽","𫟽":"𨧰","𫟾":"𨩰","𫟿":"鎈","𫠀":"䥄","𫠁":"鑉","𫠂":"閝","𫠅":"韚","𫠆":"頍","𫠇":"𩖰","𫠈":"䫾","𫠊":"䮄","𫠋":"騼","𫠌":"𩦠","𫠏":"𩵦","𫠐":"魽","𫠑":"䱸","𫠒":"鱆","𫠖":"𩿅","𫠜":"齯","𫢸":"僤","𫧃":"𣍐","𫧮":"𪋿","𫫇":"噁","𫬐":"㘔","𫭟":"塸","𫭢":"埨","𫭼":"𡑍","𫮃":"墠","𫰛":"娙","𫵷":"㠣","𫶇":"嵽","𫷷":"廞","𫸩":"彄","𬀩":"暐","𬀪":"晛","𬂩":"梜","𬃊":"櫍","𬇕":"澫","𬇙":"浿","𬇹":"漍","𬉼":"熰","𬊈":"燖","𬊤":"燀","𬍛":"瓅","𬍡":"璗","𬍤":"璕","𬒈":"礐","𬒗":"𥗽","𬕂":"篢","𬘓":"紃","𬘘":"紞","𬘡":"絪","𬘩":"綎","𬘫":"綄","𬘬":"綪","𬘭":"綝","𬘯":"綧","𬙂":"縯","𬙊":"纆","𬙋":"纕","𬜬":"蔄","𬜯":"䓣","𬞟":"蘋","𬟁":"虉","𬟽":"蝀","𬣙":"訏","𬣞":"詝","𬣡":"諓","𬣳":"詪","𬤇":"諲","𬤊":"諟","𬤝":"譓","𬨂":"軝","𬨎":"輶","𬩽":"鄩","𬪩":"醲","𬬩":"釴","𬬭":"錀","𬬮":"鋹","𬬱":"釿","𬬸":"鉥","𬬹":"鉮","𬬻":"鑪","𬬿":"鉊","𬭁":"鉧","𬭊":"𨧀","𬭎":"鋐","𬭚":"錞","𬭛":"𨨏","𬭤":"鍭","𬭩":"鎓","𬭬":"鏏","𬭭":"鏚","𬭯":"䥕","𬭳":"𨭎","𬭶":"𨭆","𬭸":"鏻","𬭼":"鐩","𬮱":"闉","𬮿":"隑","𬯀":"隮","𬯎":"隤","𬱖":"頔","𬱟":"頠","𬳵":"駓","𬳶":"駉","𬳽":"駪","𬳿":"駼","𬴂":"騑","𬴃":"騞","𬴊":"驎","𬶋":"鮈","𬶍":"鮀","𬶏":"鮠","𬶐":"鮡","𬶟":"鯻","𬶠":"鰊","𬶨":"鱀","𬶭":"鰶","𬶮":"鱚","𬷕":"鵏","𬸘":"鶠","𬸚":"鸑","𬸣":"鶱","𬸦":"鷟","𬸪":"鷭","𬸯":"鷿","𬹼":"齘","𬺈":"齮","𬺓":"齼","𰬸":"繐","𰰨":"菕","𰶎":"譅","𰾄":"鋂","𰾭":"鑀","𱊜":"𪈼"};
    const traditionalPhrases = {"关系":"關係","分布":"分佈","分钟":"分鐘","制图":"製圖","制成":"製成","反复":"反覆","合并":"合併","周期":"週期","备注":"備註","复制":"複製","复合":"複合","复成":"覆成","复杂":"複雜","复选":"複選","天后":"天后","尽可":"儘可","尽可能":"儘可能","布局":"佈局","并发":"併發","折叠":"摺疊","控制台":"控制檯","日志":"日誌","标志":"標誌","标注":"標註","汇总":"彙總","注册":"註冊","注失":"註失","注文":"註文","注标":"註標","注释":"註釋","理发":"理髮","示复":"示覆","联系":"聯繫","若干":"若干","重复":"重複","重复记录":"重複記錄","获取":"取得","保存":"儲存","设置":"設定","配置":"設定","加载":"載入","刷新":"重新整理","文件夹":"資料夾","服务器":"伺服器","账号":"帳號","帐号":"帳號","默认":"預設","登录":"登入","注销":"登出","退出登录":"登出","后台":"後台","软件":"軟體","信息":"資訊","网络":"網路","用户":"使用者"};
    const traditionalPattern = new RegExp(Object.keys(traditionalPhrases).sort((a, b) => b.length - a.length).join('|') + '|[\\u3400-\\u9fff]', 'gu');
    function translateTraditional(text) {
        return text.replace(traditionalPattern, word => traditionalPhrases[word] || traditionalCharacters[word] || word);
    }
    // END GENERATED TRADITIONAL DATA

    const originalText = new WeakMap();
    const originalAttrs = new WeakMap();
    let currentLang = getInitialLanguage();
    let observer = null;
    let isApplying = false;
    let languageRevision = 0;

    function getParentI18n() {
        try {
            return window.parent !== window ? window.parent.AppI18n : null;
        } catch { return null; }
    }

    function getSavedLanguage() {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch (error) {
            return null;
        }
    }

    function getInitialLanguage() {
        const saved = getSavedLanguage();
        if (SUPPORTED_LANGS.includes(saved)) return saved;
        const parent = getParentI18n();
        if (parent) return parent.language;
        const browserLanguages = navigator.languages || [navigator.language || ''];
        for (const locale of browserLanguages) {
            const normalized = locale.toLowerCase();
            if (/^zh-(?:hant(?:-|$)|tw$|hk$|mo$)/.test(normalized)) return 'zh-TW';
            const base = normalized.split('-')[0];
            const language = base === 'tl' ? 'fil' : base;
            if (SUPPORTED_LANGS.includes(language)) return language;
        }
        return 'en';
    }

    async function detectLanguageFromIp() {
        // A manual language choice always wins. Without one, ask the server for
        // an IP-country recommendation on every page load so travel/VPN changes
        // are reflected automatically.
        if (getParentI18n() || SUPPORTED_LANGS.includes(getSavedLanguage())) return;
        const revision = languageRevision;
        try {
            const response = await fetch('/api/language', {
                method: 'GET',
                credentials: 'same-origin',
                headers: { Accept: 'application/json' }
            });
            if (!response.ok) return;
            const data = await response.json();
            if (!data.success || !SUPPORTED_LANGS.includes(data.language)) return;
            if (revision !== languageRevision || SUPPORTED_LANGS.includes(getSavedLanguage())) return;
            setLanguage(data.language, { persist: false });
        } catch (error) {
            // Keep the browser language when IP detection is unavailable.
        }
    }

    function translateExact(text, lang) {
        if (!text || lang === DEFAULT_LANG) return text;
        const table = dictionary[lang] || {};
        return table[text] || text;
    }

    function translateWithRules(text, lang) {
        if (!text || lang === DEFAULT_LANG) return text;
        if (lang === 'zh-TW') return translateTraditional(text);
        const exact = translateExact(text, lang);
        if (exact !== text) return exact;

        const t = dictionary[lang] || {};
        const mailLimitMatch = text.match(/^每个邮箱展示最近 (\d+) 封邮件$/);
        if (mailLimitMatch) return lang === 'fil' ? `Ipakita ang ${mailLimitMatch[1]} pinakabagong mensahe bawat mailbox` : lang === 'vi'
            ? `Hiển thị ${mailLimitMatch[1]} thư mới nhất mỗi hộp thư` : `Show the latest ${mailLimitMatch[1]} messages per mailbox`;
        // Preserve status symbols, but localize the status itself.
        let match = text.match(/^([○✅❌⚠️]+\s*)(.+)$/u);
        if (match) return match[1] + translateWithRules(match[2], lang);
        match = text.match(/^(测试筛选结果|筛选无效|全选筛选结果|批量恢复|批量永久删除)\s*\((\d+)\)$/);
        if (match) return `${translateExact(match[1], lang)} (${match[2]})`;
        match = text.match(/^(批量测试中|批量测试完成|批量测试已停止|正在停止（等待进行中的测试完成）)：(\d+) \/ (\d+)；正常 (\d+)，无效 (\d+)，待重试 (\d+)$/);
        if (match) return lang === 'fil' ? `${translateExact(match[1], lang)}: ${match[2]} / ${match[3]}; maayos ${match[4]}, hindi wasto ${match[5]}, subukan muli ${match[6]}` : lang === 'vi'
            ? `${translateExact(match[1], lang)}: ${match[2]} / ${match[3]}; bình thường ${match[4]}, không hợp lệ ${match[5]}, cần thử lại ${match[6]}`
            : `${translateExact(match[1], lang)}: ${match[2]} / ${match[3]}; healthy ${match[4]}, invalid ${match[5]}, retry ${match[6]}`;
        match = text.match(/^确定要永久删除选中的 (\d+) 个邮箱账号吗？包含跨页选中的邮箱，此操作不可撤销。$/);
        if (match) return lang === 'fil' ? `Permanenteng tanggalin ang ${match[1]} napiling mailbox sa lahat ng pahina? Hindi ito maibabalik.` : lang === 'vi'
            ? `Xóa vĩnh viễn ${match[1]} hộp thư đã chọn trên mọi trang? Không thể hoàn tác.`
            : `Permanently delete ${match[1]} selected mailboxes across all pages? This cannot be undone.`;
        match = text.match(/^已选择\s*(\d+)\s*个邮箱(.*)$/);
        if (match) return lang === 'fil' ? `Napili ang ${match[1]} mailbox${match[2]}` : lang === 'vi' ? `Đã chọn ${match[1]} hộp thư${match[2]}` : `Selected ${match[1]} mailboxes${match[2]}`;
        match = text.match(/^(.+) · 使用说明$/);
        if (match) return `${translateExact(match[1], lang)} · ${translateExact('使用说明', lang)}`;
        match = text.match(/^例:\s*(.+)$/);
        if (match) return `${lang === 'fil' ? 'Hal.' : lang === 'vi' ? 'Ví dụ' : 'e.g.'}: ${match[1].replace('QQ邮箱', 'QQ Mail')}`;
        if (text.startsWith('例如：user@outlook.com----password----client_id----refresh_token')) {
            return lang === 'fil' ? 'Hal. user@outlook.com----password----client_id----refresh_token; tumatanggap din ng key=value, JSON, at mga field sa maraming linya' : lang === 'vi' ? 'Ví dụ: user@outlook.com----password----client_id----refresh_token; cũng hỗ trợ key=value, JSON hoặc các trường trên nhiều dòng'
                : 'e.g. user@outlook.com----password----client_id----refresh_token; key=value, JSON and multiline fields are also supported';
        }
        if (text.startsWith('每行一个邮箱，也支持 JSON 数组、CSV/TSV 表头和分行字段：')) {
            const examples = text.split('\n').slice(1, -1).join('\n');
            return lang === 'fil' ? `Isang mailbox bawat linya; tumatanggap din ng JSON array, CSV/TSV header, at mga field sa maraming linya:\n${examples}\nTumatanggap ng kuwit, tuldok-kuwit, patayong guhit, tutuldok, tab, espasyo, JSON, at key=value` : lang === 'vi'
                ? `Mỗi dòng một hộp thư; cũng hỗ trợ mảng JSON, tiêu đề CSV/TSV và các trường trên nhiều dòng:\n${examples}\nHỗ trợ dấu phẩy, chấm phẩy, gạch dọc, dấu hai chấm, tab, khoảng trắng, JSON và key=value`
                : `One mailbox per line; JSON arrays, CSV/TSV headers and multiline fields are also supported:\n${examples}\nSupports commas, semicolons, pipes, colons, tabs, spaces, JSON and key=value`;
        }
        match = text.match(/^(\d+)\s*封$/);
        if (match) return lang === 'fil' ? `${match[1]} mensahe` : lang === 'vi' ? `${match[1]} thư` : `${match[1]} ${match[1] === '1' ? 'message' : 'messages'}`;
        match = text.match(/^邮件正文：(.+)$/);
        if (match) return `${translateExact('邮件正文', lang)}: ${match[1]}`;
        match = text.match(/^颜色主题\s*[:：]\s*(.+)$/);
        if (match) {
            return `${translateExact('颜色主题', lang)}: ${translateExact(match[1], lang)}`;
        }
        match = text.match(/^欢迎，\s*(.+)$/);
        if (match) {
            return lang === 'fil' ? `Maligayang pagdating, ${match[1]}` : lang === 'vi' ? `Xin chào, ${match[1]}` : `Welcome, ${match[1]}`;
        }

        match = text.match(/^操作人：\s*(.+)$/);
        if (match) {
            const operator = match[1] === '历史数据'
                ? (lang === 'fil' ? 'Lumang data' : lang === 'vi' ? 'Dữ liệu cũ' : 'Legacy data')
                : match[1];
            return lang === 'fil' ? `Operator: ${operator}` : lang === 'vi' ? `Người thao tác: ${operator}` : `Operator: ${operator}`;
        }

        match = text.match(/^(\d+)\s*个邮箱\s*·\s*操作人：\s*(.+)$/);
        if (match) {
            const operator = match[2] === '历史数据'
                ? (lang === 'fil' ? 'Lumang data' : lang === 'vi' ? 'Dữ liệu cũ' : 'Legacy data')
                : match[2];
            return lang === 'fil' ? `${match[1]} mailbox · Operator: ${operator}` : lang === 'vi'
                ? `${match[1]} hộp thư · Người thao tác: ${operator}`
                : `${match[1]} mailboxes · Operator: ${operator}`;
        }

        match = text.match(/^(.+)\s*·\s*(已限制|未限制)$/);
        if (match) {
            const state = match[2] === '已限制'
                ? (lang === 'fil' ? 'May limitasyon' : lang === 'vi' ? 'Đã giới hạn' : 'Restricted')
                : (lang === 'fil' ? 'Walang limitasyon' : lang === 'vi' ? 'Chưa giới hạn' : 'Unrestricted');
            return `${match[1]} · ${state}`;
        }

        match = text.match(/^本人邮箱\s*(\d+)\s*个，授权分组\s*(\d+)\s*个，单邮箱授权\s*(\d+)\s*个$/);
        if (match) {
            return lang === 'fil' ? `Sariling mailbox ${match[1]}, pinahintulutang grupo ${match[2]}, indibidwal na pahintulot ${match[3]}` : lang === 'vi'
                ? `Hộp thư riêng ${match[1]}, nhóm được cấp ${match[2]}, hộp thư được cấp riêng ${match[3]}`
                : `Own mailboxes ${match[1]}, granted groups ${match[2]}, individual grants ${match[3]}`;
        }

        match = text.match(/^本人邮箱\s*(\d+)\s*个，额外授权\s*(\d+)\s*个$/);
        if (match) {
            return lang === 'fil' ? `Sariling mailbox ${match[1]}, dagdag na pahintulot ${match[2]}` : lang === 'vi'
                ? `Hộp thư riêng ${match[1]}, cấp thêm ${match[2]}`
                : `Own mailboxes ${match[1]}, additional grants ${match[2]}`;
        }

        if (text.startsWith('每行一个邮箱，自动识别多种格式：')) {
            return lang === 'fil' ? 'Isang mailbox bawat linya. Awtomatikong kinikilala ang maraming format:\nuser@example.com----password\nuser@hotmail.com----password----client_id----refresh_token----Graph API\nemail=user@example.com password=password client_id=... refresh_token=... auth_type=graph\nTumatanggap ng ---- / tutuldok / patayong guhit / kuwit / JSON / key=value / Graph API' : lang === 'vi'
                ? 'Mỗi dòng một hộp thư, tự nhận diện nhiều định dạng:\nuser@example.com----password\nuser@hotmail.com----password----client_id----refresh_token----Graph API\nemail=user@example.com password=password client_id=... refresh_token=... auth_type=graph\nHỗ trợ ---- / dấu hai chấm / gạch dọc / dấu phẩy / JSON / key=value / Graph API'
                : 'One mailbox per line. Multiple formats are auto-detected:\nuser@example.com----password\nuser@hotmail.com----password----client_id----refresh_token----Graph API\nemail=user@example.com password=password client_id=... refresh_token=... auth_type=graph\nSupports ---- / colon / pipe / comma / JSON / key=value / Graph API';
        }

        match = text.match(/^共\s*(\d+)\s*条记录，第\s*(\d+)\s*页，共\s*(\d+)\s*页$/);
        if (match) {
            return lang === 'fil' ? `Kabuuang ${match[1]} rekord, pahina ${match[2]} sa ${match[3]}` : lang === 'vi'
                ? `Tổng ${match[1]} bản ghi, trang ${match[2]}, tổng ${match[3]} trang`
                : `Total ${match[1]} records, page ${match[2]} of ${match[3]}`;
        }

        match = text.match(/^共\s*(\d+)\s*封邮件$/);
        if (match) {
            return lang === 'fil' ? `Kabuuang ${match[1]} mail` : lang === 'vi'
                ? `Tổng ${match[1]} thư` : `Total ${match[1]} emails`;
        }

        match = text.match(/^共\s*(\d+)\s*封邮件，第\s*(\d+)\s*\/\s*(\d+)\s*页$/);
        if (match) {
            return lang === 'fil' ? `Kabuuang ${match[1]} mail, pahina ${match[2]} / ${match[3]}` : lang === 'vi'
                ? `Tổng ${match[1]} thư, trang ${match[2]} / ${match[3]}`
                : `Total ${match[1]} mails, page ${match[2]} / ${match[3]}`;
        }

        match = text.match(/^共\s*(\d+)\s*个邮箱，第\s*(\d+)\s*\/\s*(\d+)\s*页$/);
        if (match) {
            return lang === 'fil' ? `Kabuuang ${match[1]} mailbox, pahina ${match[2]} / ${match[3]}` : lang === 'vi'
                ? `Tổng ${match[1]} hộp thư, trang ${match[2]} / ${match[3]}`
                : `Total ${match[1]} mailboxes, page ${match[2]} / ${match[3]}`;
        }

        match = text.match(/^共\s*(\d+)\s*条$/);
        if (match) {
            return lang === 'fil' ? `Kabuuang ${match[1]}` : lang === 'vi' ? `Tổng ${match[1]}` : `Total ${match[1]}`;
        }

        match = text.match(/^成功\s*(\d+)$/);
        if (match) {
            return lang === 'fil' ? `Tagumpay ${match[1]}` : lang === 'vi' ? `Thành công ${match[1]}` : `Success ${match[1]}`;
        }

        match = text.match(/^失败\s*(\d+)$/);
        if (match) {
            return lang === 'fil' ? `Nabigo ${match[1]}` : lang === 'vi' ? `Thất bại ${match[1]}` : `Failed ${match[1]}`;
        }

        match = text.match(/^(\d+)\s*条$/);
        if (match) {
            return lang === 'fil' ? `${match[1]} item` : lang === 'vi' ? `${match[1]} mục` : `${match[1]} items`;
        }

        match = text.match(/^(\d+)\s*个邮箱$/);
        if (match) {
            return lang === 'fil' ? `${match[1]} mailbox` : lang === 'vi' ? `${match[1]} hộp thư` : `${match[1]} mailboxes`;
        }

        match = text.match(/^批量复制\s*\((\d+)\)$/);
        if (match) {
            return lang === 'fil' ? `Kopyahin nang maramihan (${match[1]})` : lang === 'vi' ? `Sao chép hàng loạt (${match[1]})` : `Batch Copy (${match[1]})`;
        }

        match = text.match(/^批量删除\s*\((\d+)\)$/);
        if (match) {
            return lang === 'fil' ? `Tanggalin nang maramihan (${match[1]})` : lang === 'vi' ? `Xóa hàng loạt (${match[1]})` : `Batch Delete (${match[1]})`;
        }

        match = text.match(/^批量分组\s*\((\d+)\)$/);
        if (match) {
            return lang === 'fil' ? `Igrupo nang maramihan (${match[1]})` : lang === 'vi' ? `Phân nhóm hàng loạt (${match[1]})` : `Batch Group (${match[1]})`;
        }

        match = text.match(/^成功获取\s*(\d+)\s*封邮件$/);
        if (match) {
            return lang === 'fil' ? `Matagumpay na nakuha ang ${match[1]} mail` : lang === 'vi'
                ? `Đã lấy thành công ${match[1]} thư`
                : `Successfully fetched ${match[1]} mails`;
        }

        match = text.match(/^成功获取\s*(\d+)\s*封邮件，(\d+)\s*个邮箱失败$/);
        if (match) {
            return lang === 'fil' ? `Matagumpay na nakuha ang ${match[1]} mail, nabigo ang ${match[2]} mailbox` : lang === 'vi'
                ? `Đã lấy thành công ${match[1]} thư, ${match[2]} hộp thư thất bại`
                : `Successfully fetched ${match[1]} mails, ${match[2]} mailboxes failed`;
        }

        match = text.match(/^邮件获取成功！剩余使用次数:\s*(.+)$/);
        if (match) {
            return lang === 'fil' ? `Matagumpay na nakuha ang mail! Natitirang paggamit: ${match[1]}` : lang === 'vi'
                ? `Lấy thư thành công! Số lần còn lại: ${match[1]}`
                : `Mail fetched successfully! Remaining uses: ${match[1]}`;
        }

        match = text.match(/^成功收取\s*(\d+)\s*封新邮件$/);
        if (match) {
            return lang === 'fil' ? `Matagumpay na nakuha ang ${match[1]} bagong mail` : lang === 'vi'
                ? `Đã lấy thành công ${match[1]} thư mới`
                : `Successfully fetched ${match[1]} new mails`;
        }

        match = text.match(/^开始检测批量导入的\s*(\d+)\s*个邮箱\.\.\.$/);
        if (match) {
            return lang === 'fil' ? `Sinusuri ang ${match[1]} na-import na mailbox...` : lang === 'vi'
                ? `Bắt đầu kiểm tra ${match[1]} hộp thư vừa nhập...`
                : `Checking ${match[1]} imported mailboxes...`;
        }

        match = text.match(/^批量导入检测完成：成功\s*(\d+)\s*个，失败\s*(\d+)\s*个$/);
        if (match) {
            return lang === 'fil' ? `Tapos na ang pagsusuri ng import: ${match[1]} matagumpay, ${match[2]} nabigo` : lang === 'vi'
                ? `Kiểm tra sau nhập hoàn tất: thành công ${match[1]}, thất bại ${match[2]}`
                : `Import check completed: ${match[1]} succeeded, ${match[2]} failed`;
        }

        match = text.match(/^批量分组完成：成功\s*(\d+)\s*个(?:，失败\s*(\d+)\s*个)?$/);
        if (match) {
            const failed = match[2] || '0';
            return lang === 'fil' ? `Tapos na ang maramihang paggrupo: ${match[1]} matagumpay${match[2] ? `, ${failed} nabigo` : ''}` : lang === 'vi'
                ? `Phân nhóm hàng loạt hoàn tất: thành công ${match[1]}${match[2] ? `, thất bại ${failed}` : ''}`
                : `Batch group completed: ${match[1]} succeeded${match[2] ? `, ${failed} failed` : ''}`;
        }

        match = text.match(/^已复制：(.+)$/);
        if (match) {
            return lang === 'fil' ? `Nakopya na: ${match[1]}` : lang === 'vi' ? `Đã sao chép: ${match[1]}` : `Copied: ${match[1]}`;
        }

        match = text.match(/^已复制\s*(\d+)\s*个邮箱$/);
        if (match) {
            return lang === 'fil' ? `Nakopya na ang ${match[1]} mailbox` : lang === 'vi' ? `Đã sao chép ${match[1]} hộp thư` : `Copied ${match[1]} mailboxes`;
        }

        match = text.match(/^分组“(.+)”已存在，不能重复添加。?$/);
        if (match) {
            return lang === 'fil' ? `Umiiral na ang grupong "${match[1]}".` : lang === 'vi'
                ? `Nhóm "${match[1]}" đã tồn tại, không thể thêm trùng.`
                : `Group "${match[1]}" already exists.`;
        }

        if (text === '将添加顶级分组，添加后会自动选中。') {
            return lang === 'fil' ? 'Magdaragdag ng pangunahing grupo at awtomatiko itong pipiliin.' : lang === 'vi'
                ? 'Sẽ thêm nhóm cấp cao nhất và tự động chọn sau khi thêm.'
                : 'A top-level group will be added and selected automatically.';
        }

        match = text.match(/^将在“(.+)”下添加子分组，添加后会自动选中。$/);
        if (match) {
            return lang === 'fil' ? `Magdaragdag ng subgroup sa ilalim ng "${match[1]}" at awtomatiko itong pipiliin.` : lang === 'vi'
                ? `Sẽ thêm nhóm con trong "${match[1]}" và tự động chọn sau khi thêm.`
                : `A subgroup will be added under "${match[1]}" and selected automatically.`;
        }

        match = text.match(/^分组名称可用，点击添加后会自动选中。$/);
        if (match) {
            return lang === 'fil' ? 'Maaaring gamitin ang pangalan ng grupo at awtomatiko itong mapipili pagkatapos idagdag.' : lang === 'vi'
                ? 'Tên nhóm khả dụng; sau khi thêm sẽ tự chọn.'
                : 'Group name is available and will be selected after adding.';
        }

        match = text.match(/^已添加并选中分组“(.+)”。$/);
        if (match) {
            return lang === 'fil' ? `Naidagdag at napili na ang grupong "${match[1]}".` : lang === 'vi'
                ? `Đã thêm và chọn nhóm "${match[1]}".`
                : `Added and selected group "${match[1]}".`;
        }

        match = text.match(/^确定要删除选中的\s*(\d+)\s*个邮箱账号吗？$/);
        if (match) {
            return lang === 'fil' ? `Tanggalin ang ${match[1]} napiling account ng mailbox?` : lang === 'vi'
                ? `Xóa ${match[1]} tài khoản hộp thư đã chọn?`
                : `Delete ${match[1]} selected mailbox accounts?`;
        }

        match = text.match(/^确定要删除选中的\s*(\d+)\s*个服务器配置吗？$/);
        if (match) {
            return lang === 'fil' ? `Tanggalin ang ${match[1]} napiling configuration ng server?` : lang === 'vi'
                ? `Xóa ${match[1]} cấu hình máy chủ đã chọn?`
                : `Delete ${match[1]} selected server configurations?`;
        }

        match = text.match(/^接口返回异常（HTTP\s*(\d+)）$/);
        if (match) {
            return lang === 'fil' ? `Hindi inaasahang tugon ng API (HTTP ${match[1]})` : lang === 'vi' ? `Phản hồi API bất thường (HTTP ${match[1]})` : `Unexpected API response (HTTP ${match[1]})`;
        }

        match = text.match(/^管理员\s*(.+)\s*已删除$/);
        if (match) {
            return lang === 'fil' ? `Natanggal na ang admin na ${match[1]}` : lang === 'vi'
                ? `Quản trị viên ${match[1]} đã bị xóa`
                : `Admin ${match[1]} has been deleted`;
        }

        match = text.match(/^管理员\s*(.+)\s*的密码已重置$/);
        if (match) {
            return lang === 'fil' ? `Na-reset na ang password ng admin na ${match[1]}` : lang === 'vi'
                ? `Mật khẩu của quản trị viên ${match[1]} đã được đặt lại`
                : `Password for admin ${match[1]} has been reset`;
        }

        if (text.includes('（北京时间）')) {
            return text.replace('（北京时间）', lang === 'fil' ? '(Oras sa Beijing)' : lang === 'vi' ? '(Bắc Kinh)' : '(Beijing Time)');
        }

        if (text.includes('\n')) return text.split('\n').map((line) => translateWithRules(line, lang)).join('\n');
        return t[text] || text;
    }

    function shouldSkipNode(node) {
        const parent = node.parentElement;
        if (!parent) return true;
        return !!parent.closest(SKIP_SELECTOR + ', textarea, [data-i18n-date], [data-i18n-number]');
    }

    function translateTextNode(node) {
        if (shouldSkipNode(node)) return;
        const value = node.nodeValue;
        if (!value || !value.trim()) return;

        if (!originalText.has(node)) {
            originalText.set(node, value);
        }

        const source = originalText.get(node);
        const leading = source.match(/^\s*/)[0];
        const trailing = source.match(/\s*$/)[0];
        const trimmed = source.trim();
        const translated = translateWithRules(trimmed, currentLang);
        const next = `${leading}${translated}${trailing}`;
        if (value !== next) node.nodeValue = next;
    }

    function getOriginalAttrStore(element) {
        if (!originalAttrs.has(element)) {
            originalAttrs.set(element, {});
        }
        return originalAttrs.get(element);
    }

    function shouldTranslateValue(element) {
        if (element.tagName !== 'INPUT') return false;
        const type = (element.getAttribute('type') || 'text').toLowerCase();
        return ['button', 'submit', 'reset'].includes(type);
    }

    function translateAttributes(element) {
        if (element.closest(SKIP_SELECTOR)) return;
        if (element.hasAttribute('data-i18n-date')) {
            const next = formatDate(element.dataset.i18nDate);
            if (element.textContent !== next) element.textContent = next;
        }
        if (element.hasAttribute('data-i18n-number')) {
            const next = formatNumber(element.dataset.i18nNumber);
            if (element.textContent !== next) element.textContent = next;
        }
        const attrs = ['placeholder', 'title', 'aria-label', 'alt', 'data-label'];
        if (shouldTranslateValue(element)) {
            attrs.push('value');
        }

        const store = getOriginalAttrStore(element);
        attrs.forEach((attr) => {
            if (!element.hasAttribute(attr)) return;
            const value = element.getAttribute(attr);
            if (!value || !value.trim()) return;
            if (store[attr] === undefined) {
                store[attr] = value;
            }
            const next = translateWithRules(store[attr].trim(), currentLang);
            if (value !== next) element.setAttribute(attr, next);
        });
    }

    function walk(root) {
        if (!root) return;
        if (root.nodeType === Node.TEXT_NODE) {
            translateTextNode(root);
            return;
        }
        if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;

        if (root.nodeType === Node.ELEMENT_NODE) {
            if (root.closest(SKIP_SELECTOR)) return;
            translateAttributes(root);
        }

        const treeWalker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
            {
                acceptNode(node) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches(SKIP_SELECTOR)) {
                            return NodeFilter.FILTER_REJECT;
                        }
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        let node = treeWalker.nextNode();
        while (node) {
            if (node.nodeType === Node.TEXT_NODE) {
                translateTextNode(node);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                translateAttributes(node);
            }
            node = treeWalker.nextNode();
        }
    }

    function translateTitle() {
        if (!document.__i18nOriginalTitle) {
            document.__i18nOriginalTitle = document.title;
        }
        const source = document.__i18nOriginalTitle;
        if (currentLang === DEFAULT_LANG) {
            document.title = source;
            return;
        }
        document.title = source
            .split(' - ')
            .map((part) => translateWithRules(part, currentLang))
            .join(' - ');
    }

    function applyLanguage() {
        if (isApplying) return;
        isApplying = true;
        if (observer) {
            observer.disconnect();
        }
        try {
            document.documentElement.lang = LOCALES[currentLang];
            if (!reactManaged) {
                translateTitle();
                walk(document.body);
                syncSwitcher();
            }
        } finally {
            if (observer) {
                startObserver();
            }
            isApplying = false;
        }
    }

    function syncSwitcher() {
        const wrapper = document.getElementById('i18nLanguageSwitcher');
        const trigger = document.getElementById('i18nLanguageButton');
        if (wrapper) wrapper.dataset.language = currentLang;
        if (trigger) {
            trigger.setAttribute(
                'aria-label',
                `${translateWithRules('语言', currentLang)}: ${LANG_LABELS[currentLang]}`
            );
        }
        document.querySelectorAll('.i18n-language-option').forEach((option) => {
            const active = option.dataset.language === currentLang;
            option.classList.toggle('is-active', active);
            option.setAttribute('aria-selected', active ? 'true' : 'false');
        });
    }

    function setLanguageMenuOpen(open, focusOption = false) {
        const wrapper = document.getElementById('i18nLanguageSwitcher');
        const trigger = document.getElementById('i18nLanguageButton');
        const menu = document.getElementById('i18nLanguageMenu');
        if (!wrapper || !trigger || !menu) return;

        wrapper.classList.toggle('is-open', open);
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        menu.hidden = !open;

        if (open && focusOption) {
            const activeOption = menu.querySelector('.i18n-language-option.is-active');
            const firstOption = menu.querySelector('.i18n-language-option');
            (activeOption || firstOption)?.focus();
        }
    }

    function createSwitcher() {
        if (document.body.classList.contains('frontend-mail-page')) return;
        if (document.getElementById('i18nLanguageSwitcher')) return;

        const headerUserInfo = document.querySelector('.header-actions .user-info');
        const headerActions = headerUserInfo ? headerUserInfo.parentElement : null;
        const wrapper = document.createElement('div');
        wrapper.className = headerActions
            ? 'i18n-switcher i18n-switcher--header i18n-switcher--icon i18n-switcher--custom'
            : 'i18n-switcher i18n-switcher--icon i18n-switcher--custom';
        wrapper.id = 'i18nLanguageSwitcher';

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'i18n-language-trigger';
        trigger.id = 'i18nLanguageButton';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-controls', 'i18nLanguageMenu');
        trigger.setAttribute('title', '语言');
        trigger.innerHTML = '<span class="i18n-switcher-icon" aria-hidden="true"><svg viewBox="0 0 1024 1024"><use href="#ai-global"></use></svg></span>';

        const menu = document.createElement('div');
        menu.className = 'i18n-language-menu';
        menu.id = 'i18nLanguageMenu';
        menu.setAttribute('role', 'listbox');
        menu.setAttribute('aria-label', '语言');
        menu.hidden = true;

        SUPPORTED_LANGS.forEach((lang) => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'i18n-language-option';
            option.dataset.language = lang;
            option.setAttribute('role', 'option');

            const mark = document.createElement('span');
            mark.className = 'i18n-language-mark';
            mark.setAttribute('aria-hidden', 'true');
            mark.textContent = LANG_MARKS[lang];

            const name = document.createElement('span');
            name.className = 'i18n-language-name';
            name.textContent = LANG_LABELS[lang];

            const check = document.createElement('span');
            check.className = 'i18n-language-check';
            check.setAttribute('aria-hidden', 'true');
            check.innerHTML = '<svg viewBox="0 0 1024 1024"><use href="#ai-check"></use></svg>';

            option.append(mark, name, check);
            option.addEventListener('click', () => {
                setLanguageMenuOpen(false);
                setLanguage(lang);
                trigger.focus();
            });
            menu.appendChild(option);
        });

        trigger.addEventListener('click', () => {
            setLanguageMenuOpen(menu.hidden, false);
        });
        trigger.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !menu.hidden) {
                event.preventDefault();
                setLanguageMenuOpen(false);
                return;
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                setLanguageMenuOpen(true, true);
            }
        });
        menu.addEventListener('keydown', (event) => {
            const options = Array.from(menu.querySelectorAll('.i18n-language-option'));
            const currentIndex = options.indexOf(document.activeElement);
            let nextIndex = currentIndex;
            if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % options.length;
            if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + options.length) % options.length;
            if (event.key === 'Home') nextIndex = 0;
            if (event.key === 'End') nextIndex = options.length - 1;
            if (event.key === 'Escape') {
                event.preventDefault();
                setLanguageMenuOpen(false);
                trigger.focus();
                return;
            }
            if (nextIndex !== currentIndex && nextIndex >= 0) {
                event.preventDefault();
                options[nextIndex].focus();
            }
        });

        wrapper.append(trigger, menu);
        if (headerActions) {
            headerActions.insertBefore(wrapper, headerUserInfo);
        } else {
            document.body.appendChild(wrapper);
        }

        document.addEventListener('click', (event) => {
            if (!wrapper.contains(event.target)) {
                setLanguageMenuOpen(false);
            }
        });
    }

    function startObserver() {
        if (!observer) return;
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['placeholder', 'title', 'aria-label', 'alt', 'value', 'data-label', 'data-i18n-date', 'data-i18n-number']
        });
    }

    function observeChanges() {
        if (observer) observer.disconnect();
        let queued = false;
        const roots = new Set();
        observer = new MutationObserver((mutations) => {
            if (isApplying) return;
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length) {
                    mutation.addedNodes.forEach((node) => roots.add(node));
                }
                if (mutation.type === 'characterData') {
                    const node = mutation.target;
                    originalText.set(node, node.nodeValue);
                    roots.add(node);
                }
                if (mutation.type === 'attributes') {
                    const element = mutation.target;
                    const attr = mutation.attributeName;
                    const store = getOriginalAttrStore(element);
                    const currentValue = element.getAttribute(attr);
                    if (currentValue && currentValue.trim()) {
                        store[attr] = currentValue;
                    } else {
                        delete store[attr];
                    }
                    roots.add(element);
                }
            });
            if (roots.size && !queued) {
                queued = true;
                // Batch dynamic rows/toasts once, without walking the entire page.
                queueMicrotask(() => {
                    queued = false;
                    observer.disconnect();
                    try {
                        roots.forEach((node) => { if (node.isConnected) walk(node); });
                        roots.clear();
                    } finally { startObserver(); }
                });
            }
        });
        startObserver();
    }

    function setLanguage(lang, { persist = true, sync = true } = {}) {
        if (!SUPPORTED_LANGS.includes(lang)) return;
        languageRevision++;
        if (persist) {
            try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* In-memory sync still works. */ }
        }
        const changed = currentLang !== lang;
        currentLang = lang;
        if (changed) {
            applyLanguage();
            window.dispatchEvent(new CustomEvent('app-language-change', { detail: { language: lang } }));
        }
        if (sync) {
            const parent = getParentI18n();
            if (parent) parent.setLanguage(lang, { persist: false });
            document.querySelectorAll('iframe.legacy-frame').forEach((frame) => {
                try { frame.contentWindow.AppI18n?.setLanguage(lang, { persist: false, sync: false }); } catch { /* Cross-origin frame. */ }
            });
        }
    }

    function formatNumber(value, options = {}) {
        const number = Number(value);
        return Number.isFinite(number) ? new Intl.NumberFormat(LOCALES[currentLang], options).format(number) : String(value);
    }

    function formatDate(value, options = {}) {
        if (!value) return '-';
        // Database timestamps without offsets are stored in Beijing time.
        let normalized = typeof value === 'string' ? value.replace(' ', 'T') : value;
        if (typeof normalized === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(normalized)) normalized += '+08:00';
        const date = new Date(normalized);
        if (!Number.isFinite(date.getTime())) return String(value);
        return new Intl.DateTimeFormat(LOCALES[currentLang], {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
            timeZone: 'Asia/Shanghai', ...options
        }).format(date);
    }

    function patchDialogs() {
        if (!window.__i18nDialogsPatched) {
            const originalAlert = window.alert;
            const originalConfirm = window.confirm;
            window.alert = function (message) {
                return originalAlert.call(window, translateWithRules(String(message), currentLang));
            };
            window.confirm = function (message) {
                return originalConfirm.call(window, translateWithRules(String(message), currentLang));
            };
            window.__i18nDialogsPatched = true;
        }
    }

    function observeExternalLanguageChanges() {
        window.addEventListener('storage', (event) => {
            if (event.key !== STORAGE_KEY || !SUPPORTED_LANGS.includes(event.newValue)) return;
            if (event.newValue === currentLang) return;
            setLanguage(event.newValue, { persist: false });
        });
    }

    window.AppI18n = {
        get language() {
            return currentLang;
        },
        setLanguage,
        t(text, lang = currentLang) {
            return translateWithRules(String(text), SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG);
        },
        get locale() { return LOCALES[currentLang]; },
        languages: SUPPORTED_LANGS.map((key) => ({ key, name: LANG_LABELS[key], mark: LANG_MARKS[key] })),
        formatNumber,
        formatDate
    };

    function init() {
        patchDialogs();
        applyLanguage();
        if (!reactManaged) {
            createSwitcher();
            applyLanguage();
            observeChanges();
        }
        observeExternalLanguageChanges();
        detectLanguageFromIp();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
