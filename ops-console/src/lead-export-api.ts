export interface DownloadedLeadExport {
  readonly blob: Blob;
  readonly filename: string;
}

interface ApiErrorBody {
  readonly error?: {
    readonly message?: unknown;
  };
}

function safeFilename(
  contentDisposition: string | null,
): string {
  const match = contentDisposition === null
    ? null
    : /filename="([A-Za-z0-9._-]+)"/.exec(
        contentDisposition,
      );
  return match?.[1] ??
    "clean-up-central-leads.csv";
}

export async function downloadLeadExport(
  backendUrl: string,
  accessToken: string,
  fetchFunction: typeof fetch = fetch,
): Promise<DownloadedLeadExport> {
  const response = await fetchFunction(
    `${backendUrl.replace(/\/$/, "")}/api/ops/leads/export.csv`,
    {
      method: "GET",
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body =
        await response.json() as
          ApiErrorBody;
    } catch {
      // The safe status message below remains useful.
    }
    const message =
      body.error?.message;
    throw new Error(
      typeof message === "string"
        ? message
        : `The lead export failed with status ${response.status}.`,
    );
  }

  const contentType =
    response.headers.get(
      "content-type",
    );
  if (
    contentType === null ||
    !contentType
      .toLowerCase()
      .startsWith("text/csv")
  ) {
    throw new Error(
      "The lead export returned an unexpected file type.",
    );
  }

  return {
    blob: await response.blob(),
    filename: safeFilename(
      response.headers.get(
        "content-disposition",
      ),
    ),
  };
}
