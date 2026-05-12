import * as Sentry from '@sentry/react-native';
import { Span, StartSpanOptions, SpanTimeInput } from '@sentry/core';

const rootNode: {
    [traceId: string]: {
        name: string;
        span: Span;
        children?: {
            [spanId: string]: {
                name: string;
                span: Span;
            }
        }
    }
} = {};

const op: string[] = [];

/**
 *  获取已经设定过的op，用于Transaction过滤
 *  
 * @export
 * @return {*} 
 */
export function getTransactionOP(){
    return op;
}

export function clearAllTransaction(){
    Object.keys(rootNode).forEach((key) => {
        console.log('clear transaction:', key, rootNode[key].name);
        const node = rootNode[key];
        if (node?.children) {
            Object.values(node.children).forEach((child) => child.span?.end());
        }
        node?.span?.end();
        delete rootNode[key];
    })
}


/**
 * sentry 开始一件事务 开始计时
 *
 * @export
 * @param {string} name 事务名称
 * @param {StartSpanOptions} options 可选配置
 * @returns {string} traceId
 */
export function startTransaction(name: string, options?: Partial<StartSpanOptions>): string {
    const params = {
        name,
        op: 'operationStart', // 任意 string 意为：Operation
        forceTransaction: true,
        ...(options || {}),
    }
    const span = Sentry.startInactiveSpan(params);
    !op.includes(params.op) && op.push(params.op);
    const spanContext = span.spanContext();
    rootNode[spanContext.traceId] = { name, span };
    return spanContext.traceId;
}




/**
 * sentry 结束事务 停止计时
 *
 * @export
 * @param {string} name 事务名称
 * @param {string} traceId 使用指定traceId的事务， 当有重复的name时，可使用traceId
 * @param {SpanTimeInput} endTimestamp 结束时间戳
 */
export function finishTransaction(name: string, traceId?: string, endTimestamp?: SpanTimeInput) {
    let span: Span;
    if (traceId) {
        span = rootNode[traceId]?.span;
    } else {
        span = Object.values(rootNode).find((item) => item.name === name)?.span;
    }
    if (span) {
        span.end(endTimestamp);
        const spanContext = span.spanContext();
        delete rootNode[spanContext.traceId];
    }
}


/**
 * 给对应事务 添加一个跨度
 * 在对应的事物中间添加需要额外计时的子span
 * @export
 * @param {string} transactioName 事务名称, 数组时为多层级
 * @param {string} spanName 跨度名称
 * @param {{
 *         spanOptions?: StartSpanOptions;
 *         traceId?: string;
 *     }} [option]
 * @return {*} spanId {(string | undefined)}
 */
export function startTransactionSpan(
    transactioName: string | string[],
    spanName: string,
    option?: {
        spanOptions?: Partial<StartSpanOptions>;
        traceId?: string;
    }
): string | undefined {
    const { traceId, spanOptions } = option || {};
    let parentSpan: Span;
    let firstSpan: Span;
    if (traceId) {
        parentSpan = rootNode[traceId]?.span;
    } else {
        if (Array.isArray(transactioName)) {
            const [first, ...rest] = transactioName;
            let parent = Object.values(rootNode).find((item) => item.name === first);
            firstSpan = parent?.span;
            for (const name of rest) {
                parent = Object.values(parent?.children || {}).find((item) => item.name === name);
            }
            parentSpan = parent?.span;
        } else {
            parentSpan = Object.values(rootNode).find((item) => item.name === transactioName)?.span;
            firstSpan = parentSpan;
        }
    }
    if (parentSpan && firstSpan) {
        // Sentry.startSpan
        const span: Span = Sentry.startInactiveSpan({
            name: spanName,
            op: spanName,
            parentSpan,
            ...(spanOptions || {}),
        });
        const parentSpanContext = firstSpan.spanContext();
        const spanContext = span.spanContext();
        rootNode[parentSpanContext.traceId] = {
            ...rootNode[parentSpanContext.traceId],
            children: {
                ...(rootNode[parentSpanContext.traceId]?.children || {}),
                [spanContext.spanId]: {
                    span,
                    name: spanName,
                }
            }
        };
        return spanContext.spanId;
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
    transactioName: string | string[],
    spanName: string,
    option?: {
        traceId?: string;
        spanId?: string;
    }
) {
    const { traceId, spanId } = option || {};
    let parentSpan: Span;
    if (traceId) {
        parentSpan = rootNode[traceId]?.span;
    } else {
        const name = Array.isArray(transactioName) ? transactioName[0] : transactioName;
        parentSpan = Object.values(rootNode).find((item) => item.name === name)?.span;
    }
    if (parentSpan) {
        let span: Span;
        const parentSpanContext = parentSpan.spanContext();
        if (spanId) {
            span = rootNode[parentSpanContext.traceId]?.children?.[spanId]?.span;
        } else {
            span = Object.values(rootNode[parentSpanContext.traceId]?.children || {}).find((item) => item.name === spanName)?.span;
        }
        if (span) {
            span.end();
            delete rootNode[parentSpanContext.traceId].children[spanId];
        }
    }
}
