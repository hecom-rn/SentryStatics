import * as Sentry from '@sentry/react-native';
import { Span, Transaction, TransactionContext, MeasurementUnit } from '@sentry/types';

const rootNode: {
    [traceId: string]: {
        name: string;
        transaction: Transaction;
        span?: {
            [spanId: string]: {
                spanName: string;
                span: Span;
            };
        }
    }
} = {};

/**
 * sentry 开始一件事务 开始计时
 *
 * @export
 * @param {string} name 事务名称
 * @param {TransactionContext} options 可选配置
 * @returns {string} traceId
 */
export function startTransaction(name: string, options?: TransactionContext): string {
    const transaction = Sentry.startTransaction({
        name,
        op: 'operationStart', // 任意 string 意为：Operation
        ...(options || {}),
    });
    Sentry.getCurrentHub().configureScope((scope) => scope.setSpan(transaction));
    rootNode[transaction.traceId] = { name, transaction };
    return transaction.traceId;
}

/**
 * 给对应事务 添加一个跨度
 * 在对应的事物中间添加需要额外计时的子span
 * @export
 * @param {string} transactioName 事务名称
 * @param {string} spanName 跨度名称
 * @param {{
 *         context?: TransactionContext;
 *         traceId?: string;
 *     }} [option]
 * @return {*}  {(string | undefined)}
 */
export function startTransactionSpan(
    transactioName: string,
    spanName: string,
    option?: {
        context?: TransactionContext;
        traceId?: string;
    }
): string | undefined {
    const { context = {}, traceId } = option || {};
    let transaction: Transaction;
    if (traceId) {
        transaction = rootNode[traceId]?.transaction;
    } else {
        transaction = Object.values(rootNode).find((item) => item.name === transactioName)?.transaction;
    }
    if (transaction) {
        const span: Span = transaction.startChild({
            op: spanName,
            ...context,
            // description: `processing shopping cart result`,
        });
        rootNode[transaction.traceId] = {
            ...rootNode[transaction.traceId],
            span: {
                ...(rootNode[transaction.traceId]?.span || {}),
                [span.spanId]: {
                    span,
                    spanName,
                }
            }
        };
        return span.spanId;
    }
    return undefined;
}

/**
 *  结束事务的跨度
 *
 * @export
 * @param {string} transactioName
 * @param {string} spanName
 * @param {{
 *         traceId?: string;
 *         spanId?: string;
 *     }} [option]
 */
export function finishTransactionSpan(
    transactioName: string,
    spanName: string,
    option?: {
        traceId?: string;
        spanId?: string;
    }
) {
    const { traceId, spanId } = option || {};
    let transaction: Transaction;
    if (traceId) {
        transaction = rootNode[traceId]?.transaction;
    } else {
        transaction = Object.values(rootNode).find((item) => item.name === transactioName)?.transaction;
    }
    if (transaction) {
        let span: Span;
        if (spanId) {
            span = rootNode[transaction.traceId]?.span?.[spanId]?.span;
        } else {
            span = Object.values(rootNode[transaction.traceId]?.span || {}).find((item) => item.spanName === spanName)?.span;
        }
        if (span) {
            span.finish();
            delete rootNode[transaction.traceId].span[spanId];
        }
    }
}


/**
 * 给对应事务补充统计数据，
 * eg: transaction.setMeasurement("memoryUsed", 123, "byte"); // 这个事务过程中使用了多少内存
 * @export
 * @param {string} name 事务名称
 * @param {{ name: string; value: number; unit: MeasurementUnit }} measurementData
 * @param {string} traceId 使用指定traceId的事务， 当有重复的name时，可使用traceId
 */
export function setMeasurement(
    name: string,
    measurementData: { name: string; value: number; unit: MeasurementUnit },
    traceId?: string
) {
    let transaction: Transaction;
    if (traceId) {
        transaction = rootNode[traceId]?.transaction;
    } else {
        transaction = Object.values(rootNode).find((item) => item.name === name)?.transaction;
    }
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
 * @param {string} traceId 使用指定traceId的事务， 当有重复的name时，可使用traceId
 */
export function finishTransaction(name: string, traceId?: string) {
    let transaction: Transaction;
    if (traceId) {
        transaction = rootNode[traceId]?.transaction;
    } else {
        transaction = Object.values(rootNode).find((item) => item.name === name)?.transaction;
    }
    if (transaction) {
        transaction.finish();
        delete rootNode[transaction.traceId];
    }
}
