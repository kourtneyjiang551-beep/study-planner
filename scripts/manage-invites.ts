/**
 * 邀请码管理脚本
 *
 * 用法（需要先在 .env.local 中配置 SUPABASE_SERVICE_ROLE_KEY）：
 *   npx tsx scripts/manage-invites.ts generate --count 10
 *   npx tsx scripts/manage-invites.ts generate --count 5 --expires 30d --note "第一批付费用户"
 *   npx tsx scripts/manage-invites.ts list
 *   npx tsx scripts/manage-invites.ts delete --code HXB-ABCD
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ---------- 读取 .env.local ----------

function loadEnvLocal(): Record<string, string> {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ 未找到 .env.local 文件，请先创建并填入 Supabase 密钥');
    console.error('   模板参考 .env.local.example');
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, 'utf-8');
  const vars: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    vars[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
  }
  return vars;
}

// ---------- 参数解析 ----------

interface Args {
  command: 'generate' | 'list' | 'delete';
  count: number;
  expires: string | null;
  note: string | null;
  code: string | null;
}

function parseArgs(): Args {
  const raw = process.argv.slice(2);
  if (raw.length === 0) {
    console.error('用法: npx tsx scripts/manage-invites.ts <generate|list|delete> [选项]');
    process.exit(1);
  }

  const command = raw[0] as Args['command'];
  if (!['generate', 'list', 'delete', 'export'].includes(command)) {
    console.error(`未知命令: ${command}，可选: generate | list | delete | export`);
    process.exit(1);
  }

  const args: Args = { command, count: 1, expires: null, note: null, code: null };

  for (let i = 1; i < raw.length; i++) {
    switch (raw[i]) {
      case '--count':
        args.count = parseInt(raw[++i], 10);
        if (isNaN(args.count) || args.count < 1 || args.count > 100000) {
          console.error('--count 需要 1~100000 之间的数字');
          process.exit(1);
        }
        break;
      case '--expires':
        args.expires = raw[++i];
        break;
      case '--note':
        args.note = raw[++i];
        break;
      case '--code':
        args.code = raw[++i].toUpperCase().trim();
        break;
      default:
        console.error(`未知选项: ${raw[i]}`);
        process.exit(1);
    }
  }

  return args;
}

// ---------- 随机码生成 ----------

// 排除易混淆字符：0(零)/O(欧)/I(艾)/L(艾欧)
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ123456789';

function randomCode(): string {
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return `HXB-${suffix}`;
}

function generateCodes(count: number): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(randomCode());
  }
  return Array.from(codes);
}

// ---------- 过期时间解析 ----------

function parseExpires(raw: string): string {
  const match = raw.match(/^(\d+)([dwmy])$/);
  if (!match) {
    console.error('--expires 格式错误，示例: 30d (30天), 7d, 1w, 3m, 1y');
    process.exit(1);
  }
  const num = parseInt(match[1], 10);
  const unit = match[2];
  // 使用 SQL 区间字符串，直接传给 Supabase
  const unitMap: Record<string, string> = { d: 'days', w: 'weeks', m: 'months', y: 'years' };
  return `now() + interval '${num} ${unitMap[unit]}'`;
}

// ---------- 命令实现 ----------

async function cmdGenerate(client: ReturnType<typeof createClient>, args: Args) {
  const codes = generateCodes(args.count);
  const batchSize = 1000;
  let inserted = 0;

  for (let i = 0; i < codes.length; i += batchSize) {
    const batch = codes.slice(i, i + batchSize).map((code) => {
      const row: Record<string, string> = { code };
      if (args.expires) row.expires_at = parseExpires(args.expires);
      if (args.note) row.note = args.note;
      return row;
    });

    const { error } = await client.from('invite_codes').insert(batch);
    if (error) {
      console.error(`❌ 批次 ${Math.floor(i / batchSize) + 1} 插入失败:`, error.message);
      process.exit(1);
    }
    inserted += batch.length;
    console.log(`  已插入 ${inserted}/${codes.length}...`);
  }

  console.log(`✅ 已成功生成 ${inserted} 个邀请码`);
  // 展示前 5 个示例
  console.log('  示例: ' + codes.slice(0, 5).join(', '));
}

async function cmdList(client: ReturnType<typeof createClient>) {
  const { data, error } = await client
    .from('invite_codes')
    .select('code, used_by, used_at, expires_at, note, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('❌ 查询失败:', error.message);
    process.exit(1);
  }

  if (data.length === 0) {
    console.log('📭 暂无邀请码，请先运行 generate 命令生成');
    return;
  }

  console.log(`📋 共 ${data.length} 条邀请码：\n`);
  console.log('  邀请码      状态      过期时间      备注');
  console.log('  ' + '-'.repeat(80));

  for (const row of data) {
    let status: string;
    if (row.used_by) {
      status = `已使用 (${new Date(row.used_at).toLocaleDateString('zh-CN')})`;
    } else if (row.expires_at && new Date(row.expires_at) < new Date()) {
      status = '已过期';
    } else {
      status = '未使用';
    }
    const expires = row.expires_at ? new Date(row.expires_at).toLocaleDateString('zh-CN') : '永不过期';
    console.log(`  ${row.code.padEnd(12)} ${status.padEnd(28)} ${expires.padEnd(12)} ${row.note || ''}`);
  }
}

async function cmdDelete(client: ReturnType<typeof createClient>, args: Args) {
  if (!args.code) {
    console.error('请用 --code 指定要删除的邀请码，如: --code HXB-ABCD');
    process.exit(1);
  }

  // 只允许删除未使用的邀请码
  const { data: existing, error: lookupErr } = await client
    .from('invite_codes')
    .select('code, used_by')
    .eq('code', args.code)
    .single();

  if (lookupErr || !existing) {
    console.error(`❌ 未找到邀请码: ${args.code}`);
    process.exit(1);
  }

  if (existing.used_by) {
    console.error(`❌ 该邀请码已被使用，不可删除`);
    process.exit(1);
  }

  const { error } = await client.from('invite_codes').delete().eq('code', args.code);

  if (error) {
    console.error('❌ 删除失败:', error.message);
    process.exit(1);
  }

  console.log(`✅ 已删除邀请码: ${args.code}`);
}

async function cmdExport(client: ReturnType<typeof createClient>) {
  // 分批拉取所有数据
  const allData: any[] = [];
  const pageSize = 1000;
  let page = 0;

  while (true) {
    const { data, error } = await client
      .from('invite_codes')
      .select('code, used_by, used_at, expires_at, note, created_at')
      .order('created_at', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('❌ 查询失败:', error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) break;
    allData.push(...data);
    page++;
    console.log(`  已拉取 ${allData.length} 条...`);
  }

  if (allData.length === 0) {
    console.log('📭 暂无邀请码可导出');
    return;
  }

  // 输出 CSV（兼容各类自动发货平台）
  const header = '邀请码,状态,使用者,使用时间,过期时间,备注,创建时间';
  const rows = allData.map((row) => {
    let status: string;
    if (row.used_by) status = '已使用';
    else if (row.expires_at && new Date(row.expires_at) < new Date()) status = '已过期';
    else status = '未使用';
    return [
      row.code,
      status,
      row.used_by ?? '',
      row.used_at ? new Date(row.used_at).toLocaleDateString('zh-CN') : '',
      row.expires_at ? new Date(row.expires_at).toLocaleDateString('zh-CN') : '永不过期',
      (row.note ?? '').replace(/,/g, '，'),
      new Date(row.created_at).toLocaleDateString('zh-CN'),
    ].join(',');
  });

  const csv = [header, ...rows].join('\n');
  const filename = `invite-codes-${new Date().toISOString().slice(0, 10)}.csv`;

  // 写入项目根目录
  const outPath = path.resolve(__dirname, '..', filename);
  fs.writeFileSync(outPath, '﻿' + csv, 'utf-8'); // BOM for Excel 中文兼容
  console.log(`✅ 已导出 ${allData.length} 条邀请码到: ${filename}`);
  console.log(`   未使用: ${allData.filter(d => !d.used_by).length} 条`);
  console.log(`   已使用: ${allData.filter(d => d.used_by).length} 条`);
}

// ---------- 主流程 ----------

async function main() {
  const args = parseArgs();
  const env = loadEnvLocal();

  const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
  const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
    console.error('❌ .env.local 中 NEXT_PUBLIC_SUPABASE_URL 未配置或仍是占位值');
    process.exit(1);
  }

  if (!serviceRoleKey || serviceRoleKey.includes('placeholder')) {
    console.error('❌ .env.local 中 SUPABASE_SERVICE_ROLE_KEY 未配置或仍是占位值');
    process.exit(1);
  }

  // service_role 客户端（绕过 RLS，拥有全部权限）
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  switch (args.command) {
    case 'generate':
      await cmdGenerate(client, args);
      break;
    case 'list':
      await cmdList(client);
      break;
    case 'delete':
      await cmdDelete(client, args);
      break;
    case 'export':
      await cmdExport(client);
      break;
  }
}

main().catch((err) => {
  console.error('❌ 脚本执行出错:', err.message);
  process.exit(1);
});
