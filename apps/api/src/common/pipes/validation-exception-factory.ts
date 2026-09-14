import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from '@nestjs/common';

export interface FieldError {
  field: string;
  message: string;
}

function flatten(errors: ValidationError[], parentPath = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;
    const ownMessages = Object.values(error.constraints ?? {}).map((message) => ({
      field,
      message,
    }));
    const childMessages = error.children?.length ? flatten(error.children, field) : [];
    return [...ownMessages, ...childMessages];
  });
}

export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    message: 'Validation failed',
    details: flatten(errors),
  });
}
