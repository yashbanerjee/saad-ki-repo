import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseCuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!value || !/^c[a-z0-9]{24,}$/.test(value)) {
      throw new BadRequestException('Invalid ID format');
    }
    return value;
  }
}
