import { Pipe, PipeTransform } from '@angular/core';
import { formatTimeString, TimeDisplayFormat } from './time-format.util';

@Pipe({
  name: 'timeRange',
  standalone: true
})
export class TimeRangePipe implements PipeTransform {
  transform(
    startTime: string | null | undefined,
    endTime: string | null | undefined,
    format: TimeDisplayFormat = '12h'
  ): string {
    if (!startTime && !endTime) return '';
    if (!startTime) return formatTimeString(endTime, format);
    if (!endTime) return formatTimeString(startTime, format);
    return `${formatTimeString(startTime, format)} - ${formatTimeString(endTime, format)}`;
  }
}

