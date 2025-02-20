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
import * as Immutable from 'immutable';
import { render } from 'wrappedTestingLibrary';

import { alice as currentUser } from 'fixtures/users';
import User from 'logic/users/User';
import CurrentUserContext from 'contexts/CurrentUserContext';
import { createGRN } from 'logic/permissions/GRN';

import HasOwnership from './HasOwnership';

type Props = {
  currentUser: User,
  id: string,
  type: string,
  hideChildren?: boolean,
};

describe('HasOwnership', () => {
  // eslint-disable-next-line react/prop-types
  const DisabledComponent = ({ disabled }: { disabled: boolean}) => {
    return disabled
      ? <span>disabled</span>
      : <span>enabled</span>;
  };

  const SimpleHasOwnership = ({ currentUser: user = currentUser, ...props }: Props) => (
    <CurrentUserContext.Provider value={user}>
      <HasOwnership {...props}>
        {({ disabled }) => (
          <DisabledComponent disabled={disabled} />
        )}
      </HasOwnership>
    </CurrentUserContext.Provider>
  );

  SimpleHasOwnership.defaultProps = {
    hideChildren: false,
  };

  const type = 'stream';
  const id = '000000000001';
  const grn = createGRN(type, id);
  const grnPermission = `entity:own:${grn}`;

  const otherType = 'dashboard';
  const otherId = 'beef000011';
  const otherGrn = createGRN(otherType, otherId);
  const otherGrnPermission = `entity:own:${otherGrn}`;

  it('should render children enabled if user has ownership', () => {
    const user = currentUser.toBuilder()
      .grnPermissions(Immutable.List([grnPermission]))
      .permissions(Immutable.List())
      .build();
    const { getByText: queryByText } = render(
      <SimpleHasOwnership currentUser={user} id={id} type={type} />,
    );

    expect(queryByText('enabled')).toBeTruthy();
  });

  it('should render children disabled if user has empty ownership and is not admin', () => {
    const user = currentUser.toBuilder()
      .grnPermissions(Immutable.List(Immutable.List()))
      .permissions(Immutable.List())
      .build();
    const { queryByText } = render(
      <SimpleHasOwnership currentUser={user} id={id} type={type} />,
    );

    expect(queryByText('disabled')).toBeTruthy();
  });

  it('should render children disabled if user has wrong ownership and is not admin', () => {
    const user = currentUser.toBuilder()
      .grnPermissions(Immutable.List([otherGrnPermission]))
      .permissions(Immutable.List())
      .build();
    const { queryByText } = render(
      <SimpleHasOwnership currentUser={user} id={id} type={type} />,
    );

    expect(queryByText('disabled')).toBeTruthy();
  });

  it('should render children disabled if user has wrong ownership and is reader', () => {
    const user = currentUser.toBuilder()
      .grnPermissions(Immutable.List([otherGrnPermission]))
      .permissions(Immutable.List([`streams:read:${id}`]))
      .build();
    const { queryByText } = render(
      <SimpleHasOwnership currentUser={user} id={id} type={type} />,
    );

    expect(queryByText('disabled')).toBeTruthy();
  });

  it('should render children disabled if user has no ownership and is reader', () => {
    const user = currentUser.toBuilder()
      .grnPermissions(Immutable.List([]))
      .permissions(Immutable.List([`streams:read:${id}`]))
      .build();
    const { queryByText } = render(
      <SimpleHasOwnership currentUser={user} id={id} type={type} />,
    );

    expect(queryByText('disabled')).toBeTruthy();
  });

  it('should render children enabled if user has empty ownership and is admin', () => {
    const user = currentUser.toBuilder()
      .grnPermissions(Immutable.List([]))
      .permissions(Immutable.List(['*']))
      .build();
    const { queryByText } = render(
      <SimpleHasOwnership currentUser={user} id={id} type={type} />,
    );

    expect(queryByText('enabled')).toBeTruthy();
  });

  it('should render children enabled if user has wrong ownership and is admin', () => {
    const user = currentUser.toBuilder()
      .grnPermissions(Immutable.List([otherGrnPermission]))
      .permissions(Immutable.List(['*']))
      .build();
    const { queryByText } = render(
      <SimpleHasOwnership currentUser={user} id={id} type={type} />,
    );

    expect(queryByText('enabled')).toBeTruthy();
  });

  it('should hide children when configured', () => {
    const user = currentUser.toBuilder()
      .grnPermissions(Immutable.List([otherGrnPermission]))
      .permissions(Immutable.List([]))
      .build();
    const { queryByText } = render(
      <SimpleHasOwnership currentUser={user} id={id} type={type} hideChildren />,
    );

    expect(queryByText('disabled')).toBeFalsy();
    expect(queryByText('enabled')).toBeFalsy();
  });
});
