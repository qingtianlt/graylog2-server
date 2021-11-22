/*
 * Copyright (C) 2020 Graylog, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the Server Side Public License, version 1,
 * as published by MongoDB, Inc.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * Server Side Public License for more details.
 *
 * You should have received a copy of the Server Side Public License
 * along with this program. If not, see
 * <http://www.mongodb.com/licensing/server-side-public-license>.
 */
import * as React from 'react';
import { useEffect, useState, useContext } from 'react';
import styled, { css } from 'styled-components';
import PropTypes from 'prop-types';
import { useFormikContext } from 'formik';
import { Moment } from 'moment';

import { readableRange } from 'views/logic/queries/TimeRangeToString';
import { isTypeRelative, isTypeRelativeWithEnd, isTypeRelativeWithStartOnly } from 'views/typeGuards/timeRange';
import type { TimeRange, NoTimeRangeOverride } from 'views/logic/queries/Query';
import { Icon } from 'components/common';
import { DATE_TIME_FORMATS } from 'contexts/DateTimeProvider';
import { SearchBarFormValues } from 'views/Constants';
import DateTimeContext from 'contexts/DateTimeContext';

import { EMPTY_OUTPUT, EMPTY_RANGE } from '../TimeRangeDisplay';

type Props = {
  timerange?: TimeRange | NoTimeRangeOverride,
};

const PreviewWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  float: right;
  transform: translateY(-3px);
`;

const FromWrapper = styled.span`
  text-align: right;
`;

const UntilWrapper = styled.span`
  text-align: left;
`;

const Title = styled.span(({ theme }) => css`
  font-size: ${theme.fonts.size.large};
  color: ${theme.colors.variant.darker.info};
  display: block;
  font-style: italic;
`);

const Date = styled.span(({ theme }) => css`
  font-size: ${theme.fonts.size.body};
  color: ${theme.colors.variant.dark.primary};
  display: block;
  font-weight: bold;
`);

const MiddleIcon = styled.span(({ theme }) => css`
  font-size: ${theme.fonts.size.large};
  color: ${theme.colors.variant.default};
  padding: 0 15px;
`);

const dateOutput = (timerange: TimeRange | NoTimeRangeOverride, adjustTimezone: (time: Date) => Moment, formatTime) => {
  let from = EMPTY_RANGE;
  let to = EMPTY_RANGE;

  if (!timerange) {
    return EMPTY_OUTPUT;
  }

  if (isTypeRelative(timerange)) {
    if (isTypeRelativeWithStartOnly(timerange)) {
      from = readableRange(timerange, 'range', adjustTimezone);
    }

    if (isTypeRelativeWithEnd(timerange)) {
      from = readableRange(timerange, 'from', adjustTimezone);
    }

    to = readableRange(timerange, 'to', adjustTimezone, 'Now');

    return {
      from,
      until: to,
    };
  }

  return {
    from: 'from' in timerange ? formatTime(timerange.from, undefined, 'complete') : from,
    until: 'to' in timerange ? formatTime(timerange.to, undefined, 'complete') : to,
  };
};

const TimeRangeLivePreview = ({ timerange }: Props) => {
  const { adjustTimezone, formatTime } = useContext(DateTimeContext);
  const { isValid } = useFormikContext<SearchBarFormValues>();
  const [{ from, until }, setTimeOutput] = useState(EMPTY_OUTPUT);

  useEffect(() => {
    let output = EMPTY_OUTPUT;

    if (isValid) {
      output = dateOutput(timerange, adjustTimezone, formatTime);
    }

    setTimeOutput(output);
  }, [isValid, timerange, adjustTimezone, formatTime]);

  return (
    <PreviewWrapper data-testid="time-range-live-preview">
      <FromWrapper>
        <Title>From</Title>
        <Date title={`Dates Formatted as [${DATE_TIME_FORMATS.complete}]`}>{from}</Date>
      </FromWrapper>

      <MiddleIcon>
        <Icon name="arrow-right" />
      </MiddleIcon>

      <UntilWrapper>
        <Title>Until</Title>
        <Date title={`Dates Formatted as [${DATE_TIME_FORMATS.complete}]`}>{until}</Date>
      </UntilWrapper>
    </PreviewWrapper>
  );
};

TimeRangeLivePreview.propTypes = {
  timerange: PropTypes.shape({
    range: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    from: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    to: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }),
};

TimeRangeLivePreview.defaultProps = {
  timerange: undefined,
};

export default TimeRangeLivePreview;
