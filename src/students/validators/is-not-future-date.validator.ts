import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function IsNotFutureDate(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isNotFutureDate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') {
            return false;
          }

          const date = new Date(`${value}T00:00:00.000Z`);
          if (Number.isNaN(date.getTime())) {
            return false;
          }

          const today = new Date();
          const todayUtc = new Date(
            Date.UTC(
              today.getUTCFullYear(),
              today.getUTCMonth(),
              today.getUTCDate(),
            ),
          );

          return date.getTime() <= todayUtc.getTime();
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must not be a future date`;
        },
      },
    });
  };
}
