import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsVietnamesePhone(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isVietnamesePhone',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const phoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
          return typeof value === 'string' && phoneRegex.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} phải là số điện thoại Việt Nam hợp lệ (ví dụ: 0912345678)`;
        },
      },
    });
  };
}
