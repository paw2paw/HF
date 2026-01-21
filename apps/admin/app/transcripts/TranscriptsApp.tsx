"use client";

import React from 'react';
import { Admin, Resource } from 'react-admin';
import simpleRestProvider from 'ra-data-simple-rest';
import { AdminListPage } from '../admin/shared/AdminListPage';
import { transcriptsTableConfig } from '../admin/configs/transcriptsTableConfig';

const dataProvider = simpleRestProvider('/api');

/**
 * Custom layout that removes React-Admin's navigation chrome
 * Integrates with the existing sidebar navigation in the app
 */
const CustomLayout = ({ children }: { children: React.ReactNode }) => (
  <div style={{ padding: '0' }}>
    {children}
  </div>
);

export default function TranscriptsApp() {
  return (
    <Admin dataProvider={dataProvider} layout={CustomLayout}>
      <Resource
        name="transcripts"
        list={() => (
          <AdminListPage
            config={transcriptsTableConfig}
            perPage={50}
            defaultSort={{ field: 'modifiedAt', order: 'DESC' }}
            searchable={false}
          />
        )}
      />
    </Admin>
  );
}
