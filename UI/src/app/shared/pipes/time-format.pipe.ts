import { Pipe, PipeTransform } from '@angular/core';
import { formatTimeString, TimeDisplayFormat } from './time-format.util';

@Pipe({
  name: 'timeFormat',
  standalone: true
})
export class TimeFormatPipe implements PipeTransform {
  transform(time: string | null | undefined, format: TimeDisplayFormat = '12h'): string {
    return formatTimeString(time, format);
  }
}

