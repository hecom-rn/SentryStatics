import * as Sentry from '@sentry/react-native';
import { Span, Transaction, TransactionContext, MeasurementUnit } from '@sentry/types';

const rootNode: { [key: string]: Transaction } = {};

/**
 * sentry 开始一件事务 开始计时
 *
 * @export
 * @param {string} name 事务名称
 * @param {TransactionContext} options 可选配置
 */
export function startTransaction(name: string, options?: TransactionContext) {
    const transaction = Sentry.startTransaction({
        name,
        op: 'start', // 任意 string 意为：Operation
        ...(options || {}),
    });
    Sentry.getCurrentHub().configureScope((scope) => scope.setSpan(transaction));
    rootNode[name] = transaction;
}

/**
 * 给对应事务 添加一个跨度
 * 在对应的事物中间添加需要额外计时的子span
 * @export
 * @param {string} name 事务名称
 * @param {() => void} block
 * @param {TransactionContext} options 可选配置
 */
export function addTransactionSpan(name: string, block: () => void, options?: TransactionContext) {
    const transaction: Transaction = rootNode[name];
    if (transaction) {
        const span: Span = transaction.startChild({
            op: 'appendSpan',
            ...(options || {}),
            // description: `processing shopping cart result`,
        });
        block?.();
        span.finish();
    }
}

/**
 * 给对应事务补充统计数据，
 * eg: transaction.setMeasurement("memoryUsed", 123, "byte"); // 这个事务过程中使用了多少内存
 * @export
 * @param {string} name 事务名称
 * @param {{ name: string; value: number; unit: MeasurementUnit }} measurementData
 */
export function setMeasurement(
    name: string,
    measurementData: { name: string; value: number; unit: MeasurementUnit }
) {
    const transaction: Transaction = rootNode[name];
    if (transaction) {
        const { name: measurementName, value, unit } = measurementData;
        transaction.setMeasurement(measurementName, value, unit);
    }
}

/**
 * sentry 结束事务 停止计时
 *
 * @export
 * @param {string} name 事务名称
 */
export function finishTransaction(name: string) {
    const transaction: Transaction = rootNode[name];
    if (transaction) {
        transaction.finish();
    }
}