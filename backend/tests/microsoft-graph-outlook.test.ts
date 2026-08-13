import assert from "node:assert/strict";
import test from "node:test";

import {
  MicrosoftGraphOutlookGateway,
} from "../src/adapters/microsoft/microsoft-graph-outlook.js";

import type {
  OutlookConnectionRepository,
  SaveOutlookConnectionInput,
  StoredOutlookConnection,
} from "../src/adapters/supabase/supabase-outlook-connection-repository.js";

const FOUNDER_ID =
  "22222222-2222-4222-8222-222222222222";

function memoryRepository():
  OutlookConnectionRepository & {
    readonly state: {
      value?: {
        readonly stateHash: string;
        readonly founderId: string;
        readonly encryptedVerifier: string;
      };
    };
    readonly connection: {
      value?: StoredOutlookConnection;
    };
  } {
  const state: {
    value?: {
      readonly stateHash: string;
      readonly founderId: string;
      readonly encryptedVerifier: string;
    };
  } = {};
  const connection: {
    value?: StoredOutlookConnection;
  } = {};
  return {
    state,
    connection,
    async saveOAuthState(input) {
      state.value = input;
    },
    async consumeOAuthState(stateHash) {
      assert.equal(
        stateHash,
        state.value?.stateHash,
      );
      const current = state.value!;
      delete state.value;
      return {
        founderId: current.founderId,
        encryptedVerifier:
          current.encryptedVerifier,
      };
    },
    async getConnection(founderId) {
      assert.equal(founderId, FOUNDER_ID);
      return connection.value ?? null;
    },
    async saveConnection(
      input: SaveOutlookConnectionInput,
    ) {
      connection.value = {
        ...input,
        connectedAt:
          connection.value?.connectedAt ??
          "2026-08-13T12:00:00.000Z",
      };
    },
  };
}

test(
  "delegated OAuth and Graph create one draft without requesting or calling send",
  async () => {
    const repository = memoryRepository();
    const requests: {
      readonly url: string;
      readonly init: RequestInit;
    }[] = [];
    const gateway =
      new MicrosoftGraphOutlookGateway({
        clientId:
          "11111111-1111-4111-8111-111111111111",
        clientSecret: "secret",
        tenantId: "consumers",
        redirectUri:
          "https://backend.example/api/ops/leads/outlook/callback",
        graphBaseUrl:
          "https://graph.microsoft.com/v1.0",
        loginBaseUrl:
          "https://login.microsoftonline.com",
        tokenEncryptionKey:
          Buffer.alloc(32, 7)
            .toString("base64"),
        timeoutMs: 1_000,
        repository,
        fetchFunction: (async (input, init = {}) => {
          const url = String(input);
          requests.push({ url, init });
          if (url.endsWith("/token")) {
            return Response.json({
              access_token: "access-token",
              refresh_token:
                "refresh-token",
              expires_in: 3600,
              scope:
                "openid profile email offline_access Mail.ReadWrite",
            });
          }
          if (url.includes("/me?$select=")) {
            return Response.json({
              mail: "founder@outlook.com",
              userPrincipalName:
                "founder@outlook.com",
            });
          }
          if (url.includes(
            "/mailFolders/drafts/messages",
          )) {
            return Response.json({ value: [] });
          }
          if (url.endsWith("/me/messages")) {
            return Response.json(
              {
                id: "graph-draft-id",
                webLink:
                  "https://outlook.live.com/mail/0/drafts/id/graph-draft-id",
              },
              { status: 201 },
            );
          }
          throw new Error(
            `Unexpected request ${url}`,
          );
        }) as typeof fetch,
      });

    const authorizationUrl =
      await gateway.createAuthorizationUrl(
        FOUNDER_ID,
      );
    const authorization = new URL(
      authorizationUrl,
    );
    assert.equal(
      authorization.searchParams.get(
        "code_challenge_method",
      ),
      "S256",
    );
    const scope =
      authorization.searchParams.get(
        "scope",
      ) ?? "";
    assert.match(scope, /Mail\.ReadWrite/);
    assert.doesNotMatch(scope, /Mail\.Send/);
    assert.notEqual(
      repository.state.value
        ?.encryptedVerifier,
      null,
    );

    await gateway.completeAuthorization(
      "authorization-code",
      authorization.searchParams.get(
        "state",
      )!,
    );
    assert.equal(
      repository.connection.value
        ?.mailboxEmail,
      "founder@outlook.com",
    );
    assert.notEqual(
      repository.connection.value
        ?.encryptedRefreshToken,
      "refresh-token",
    );

    const created =
      await gateway.createOrRecoverDraft({
        founderId: FOUNDER_ID,
        internalDraftId:
          "55555555-5555-4555-8555-555555555555",
        recipientEmail:
          "hello@example.com",
        subject: "Cleaning support",
        body: "Hello",
      });
    assert.equal(
      created.outlookDraftId,
      "graph-draft-id",
    );
    assert.equal(
      requests.some((request) =>
        request.url.toLowerCase()
          .includes("send"),
      ),
      false,
    );
    const createRequest = requests.find(
      (request) =>
        request.url.endsWith(
          "/me/messages",
        ),
    )!;
    const body = JSON.parse(
      String(createRequest.init.body),
    );
    assert.equal(
      body.toRecipients[0]
        .emailAddress.address,
      "hello@example.com",
    );
    assert.deepEqual(
      body.internetMessageHeaders,
      [{
        name:
          "x-clean-up-central-draft-id",
        value:
          "55555555-5555-4555-8555-555555555555",
      }],
    );
  },
);

test(
  "OAuth is rejected if Microsoft returns Mail.Send permission",
  async () => {
    const repository = memoryRepository();
    const gateway =
      new MicrosoftGraphOutlookGateway({
        clientId:
          "11111111-1111-4111-8111-111111111111",
        clientSecret: "secret",
        tenantId: "consumers",
        redirectUri:
          "https://backend.example/api/ops/leads/outlook/callback",
        graphBaseUrl:
          "https://graph.microsoft.com/v1.0",
        loginBaseUrl:
          "https://login.microsoftonline.com",
        tokenEncryptionKey:
          Buffer.alloc(32, 8)
            .toString("base64"),
        timeoutMs: 1_000,
        repository,
        fetchFunction: (async () =>
          Response.json({
            access_token: "access-token",
            refresh_token: "refresh-token",
            expires_in: 3600,
            scope:
              "offline_access Mail.ReadWrite Mail.Send",
          })) as typeof fetch,
      });
    const authorizationUrl =
      await gateway.createAuthorizationUrl(
        FOUNDER_ID,
      );

    await assert.rejects(
      gateway.completeAuthorization(
        "authorization-code",
        new URL(authorizationUrl)
          .searchParams.get("state")!,
      ),
      /unsupported Outlook permissions/,
    );
  },
);
