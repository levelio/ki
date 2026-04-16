import * as clack from '@clack/prompts'

type SpinnerResult = ReturnType<typeof clack.spinner>
type LogMethod = 'log' | 'warn' | 'error'

function usePlainOutput(): boolean {
  return !process.stdout.isTTY || !process.stderr.isTTY
}

function write(
  method: LogMethod,
  message?: string | string[],
  prefix?: string,
): void {
  if (message === undefined) {
    return
  }

  const text = Array.isArray(message) ? message.join('\n') : message
  const formatted = prefix ? `${prefix}: ${text}` : text
  console[method](formatted)
}

class PlainSpinner implements SpinnerResult {
  isCancelled = false
  #lastMessage?: string

  start(msg?: string): void {
    this.#emit('log', msg)
  }

  stop(msg?: string): void {
    this.#emit('log', msg)
  }

  cancel(msg?: string): void {
    this.isCancelled = true
    this.#emit('error', msg, 'Cancelled')
  }

  error(msg?: string): void {
    this.#emit('error', msg, 'Error')
  }

  message(msg?: string): void {
    this.#emit('log', msg)
  }

  clear(): void {}

  #emit(method: LogMethod, message?: string, prefix?: string): void {
    if (!message || message === this.#lastMessage) {
      return
    }

    this.#lastMessage = message
    write(method, message, prefix)
  }
}

export function isCancel(value: unknown): boolean {
  if (!('isCancel' in clack) || typeof clack.isCancel !== 'function') {
    return false
  }

  return clack.isCancel(value as never)
}

export function intro(title?: string): void {
  if (usePlainOutput()) {
    write('log', title)
    return
  }

  clack.intro(title)
}

export function outro(message?: string): void {
  if (usePlainOutput()) {
    write('log', message)
    return
  }

  clack.outro(message)
}

export function note(message?: string, title?: string): void {
  if (usePlainOutput()) {
    if (title && message) {
      write('log', `${title}: ${message}`)
      return
    }

    write('log', message ?? title)
    return
  }

  clack.note(message, title)
}

export function spinner(): SpinnerResult {
  if (usePlainOutput()) {
    return new PlainSpinner()
  }

  return clack.spinner()
}

export const log = {
  error(message: string): void {
    if (usePlainOutput()) {
      write('error', message, 'Error')
      return
    }

    clack.log.error(message)
  },
  warn(message: string): void {
    if (usePlainOutput()) {
      write('warn', message, 'Warning')
      return
    }

    clack.log.warn(message)
  },
  success(message: string): void {
    if (usePlainOutput()) {
      write('log', message, 'Success')
      return
    }

    clack.log.success(message)
  },
}

export async function confirm(
  options: Parameters<typeof clack.confirm>[0],
): Promise<ReturnType<typeof clack.confirm>> {
  if (usePlainOutput()) {
    return (options.initialValue ?? false) as Awaited<
      ReturnType<typeof clack.confirm>
    >
  }

  return clack.confirm(options)
}

export async function autocompleteMultiselect<Value>(
  options: Parameters<typeof clack.autocompleteMultiselect<Value>>[0],
): Promise<ReturnType<typeof clack.autocompleteMultiselect<Value>>> {
  if (usePlainOutput()) {
    throw new Error('Interactive prompts require a TTY')
  }

  return clack.autocompleteMultiselect(options)
}
