import * as assert from 'assert';
import { parseLine, parseText } from '../utils/parser';

suite('Parser', () => {
  test('parseLine start', () => {
    const n = parseLine('// flow-Auth start 初始化', '/tmp/a.ts', 10);
    assert.ok(n);
    assert.strictEqual(n!.feature, 'Auth');
    assert.strictEqual(n!.role, 'start');
    assert.strictEqual(n!.order, undefined);
    assert.strictEqual(n!.meta?.desc, '初始化');
  });

  test('parseLine end', () => {
    const n = parseLine('// flow-支付 end 收尾', '/tmp/a.ts', 20);
    assert.ok(n);
    assert.strictEqual(n!.feature, '支付');
    assert.strictEqual(n!.role, 'end');
    assert.strictEqual(n!.order, undefined);
    assert.strictEqual(n!.meta?.desc, '收尾');
  });

  test('parseLine step levels', () => {
    const n = parseLine('// flow-订单 1.2.3 参数校验', '/tmp/a.ts', 30);
    assert.ok(n);
    assert.strictEqual(n!.feature, '订单');
    assert.strictEqual(n!.role, 'step');
    assert.deepStrictEqual(n!.order?.levels, [1,2,3]);
    assert.strictEqual(n!.meta?.desc, '参数校验');
  });

  test('supports no space after // and multiple spaces between tokens', () => {
    const n1 = parseLine('//flow-Feat 2 描述', '/tmp/a.ts', 5);
    assert.ok(n1);
    assert.strictEqual(n1!.feature, 'Feat');
    assert.deepStrictEqual(n1!.order?.levels, [2]);
    const n2 = parseLine('//  flow-Feat    2    多空格', '/tmp/a.ts', 6);
    assert.ok(n2);
    assert.strictEqual(n2!.feature, 'Feat');
    assert.deepStrictEqual(n2!.order?.levels, [2]);
  });

  test('leading zeros in order are parsed as numbers', () => {
    const n = parseLine('// flow-Feat 001.02 前导零', '/tmp/a.ts', 7);
    assert.ok(n);
    assert.deepStrictEqual(n!.order?.levels, [1,2]);
  });

  test('parseLine title syntax', () => {
    const n = parseLine('// flow-login-变量 密码状态', '/tmp/a.ts', 12);
    assert.ok(n);
    assert.strictEqual(n!.feature, 'login');
    assert.strictEqual(n!.role, 'title');
    assert.strictEqual(n!.order, undefined);
    assert.strictEqual(n!.meta?.title, '变量');
    assert.strictEqual(n!.meta?.desc, '密码状态');
  });

  test('invalid tail after numeric order becomes part of desc; missing kind returns null', () => {
    const a = parseLine('// flow-Feat 1.a 不合法', '/tmp/a.ts', 8);
    assert.ok(a);
    assert.strictEqual(a!.role, 'step');
    assert.deepStrictEqual(a!.order?.levels, [1]);
    assert.strictEqual(a!.meta?.desc, '.a 不合法');
    // Now supports no-order syntax
    const b = parseLine('// flow-Feat  描述缺少种类', '/tmp/a.ts', 9);
    assert.ok(b);
    assert.strictEqual(b!.feature, 'Feat');
    assert.strictEqual(b!.role, 'step');
    assert.strictEqual(b!.order, undefined);
    assert.strictEqual(b!.meta?.desc, '描述缺少种类');
  });

  test('parseLine no order syntax', () => {
    const n = parseLine('// flow-login some desc', '/tmp/a.ts', 10);
    assert.ok(n);
    assert.strictEqual(n!.feature, 'login');
    assert.strictEqual(n!.role, 'step');
    assert.strictEqual(n!.order, undefined);
    assert.strictEqual(n!.meta?.desc, 'some desc');
  });


  test('parseText collects multiple lines and ignores non-matching', () => {
    const text = [
      'const a = 1;',
      '// flow-Auth start',
      '// flow-Auth 1 登录入口',
      '/* some other comment */',
      '// flow-Auth end',
      '// mark 关键点',
      '// mark',
    ].join('\n');
    const nodes = parseText(text, '/x.ts');
    assert.strictEqual(nodes.length, 5);
    assert.strictEqual(nodes[0].role, 'start');
    assert.strictEqual(nodes[1].role, 'step');
    assert.strictEqual(nodes[2].role, 'end');
    assert.strictEqual(nodes[3].role, 'mark');
    assert.strictEqual(nodes[3].meta?.desc, '关键点');
    assert.strictEqual(nodes[4].role, 'mark');
    assert.strictEqual(nodes[4].meta, undefined);
  });
});
