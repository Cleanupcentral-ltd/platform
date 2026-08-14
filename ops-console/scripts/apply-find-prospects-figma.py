from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))


view = "ops-console/src/LeadDiscoveryView.tsx"
engine = "ops-console/src/LeadEngineRedesign.tsx"

replace_once(
    view,
    '} from "./redesign-helpers";\n',
    '} from "./redesign-helpers";\n\nimport "./lead-discovery-editorial.css";\n',
)

replace_once(
    view,
    '''  readonly onOpenProspect: (\n    prospectId: string,\n    ready: boolean,\n  ) => void;\n  readonly onMessage: (''',
    '''  readonly onOpenProspect: (\n    prospectId: string,\n    ready: boolean,\n  ) => void;\n  readonly exportEnabled?: boolean;\n  readonly exporting?: boolean;\n  readonly onExportCsv?: () => void;\n  readonly onMessage: (''',
)

replace_once(
    view,
    '''function nullable(value: FormDataEntryValue | null):\n  string | null {\n  const cleaned = String(value ?? "").trim();\n  return cleaned === "" ? null : cleaned;\n}\n''',
    '''function nullable(value: FormDataEntryValue | null):\n  string | null {\n  const cleaned = String(value ?? "").trim();\n  return cleaned === "" ? null : cleaned;\n}\n\nfunction compactSectorLabel(\n  sector: LeadSector | null,\n): string {\n  switch (sector) {\n    case "short_let_serviced_accommodation":\n      return "SHORT-LET / SERVICED";\n    case "offices_coworking":\n      return "OFFICE / COWORKING";\n    case "community_halls_event_venues":\n      return "COMMUNITY / EVENTS";\n    case "estate_letting_agents":\n      return "ESTATE AGENCY";\n    case "university_accommodation":\n      return "UNIVERSITY ACCOMMODATION";\n    case "other_commercial_spaces":\n      return "COMMERCIAL SPACE";\n    default:\n      return "LOCAL BUSINESS";\n  }\n}\n''',
)

replace_once(
    view,
    '''  refreshProspects,\n  onOpenProspect,\n  onMessage,\n  onError,\n}: LeadDiscoveryViewProps) {''',
    '''  refreshProspects,\n  onOpenProspect,\n  exportEnabled = false,\n  exporting = false,\n  onExportCsv,\n  onMessage,\n  onError,\n}: LeadDiscoveryViewProps) {''',
)

replace_once(
    view,
    '''  const [searchMode, setSearchMode] =\n    useState<"postcode" | "borough">(\n      "borough",\n    );''',
    '''  const [searchMode, setSearchMode] =\n    useState<"postcode" | "borough">(\n      "postcode",\n    );''',
)

replace_once(
    view,
    '''  return (\n    <section className="le-view">\n      <div className="le-view-heading">\n        <div>\n          <p className="le-overline">\n            PROSPECT DISCOVERY\n          </p>\n          <h2>\n            Find local businesses worth reviewing.\n          </h2>\n          <p>\n            Search public business data by postcode or London borough. New results enter the existing automatic verification journey in the background.\n          </p>\n        </div>\n      </div>''',
    '''  return (\n    <section className="le-view le-discovery">\n      <div className="le-discovery-heading">\n        <p className="le-overline">\n          LOCAL DISCOVERY\n        </p>\n        <h2>Build your local list</h2>\n      </div>''',
)

replace_once(
    view,
    '''        <label>\n          <span>Search by</span>\n          <select\n            value={searchMode}\n            onChange={(event) =>\n              setSearchMode(\n                event.target.value as\n                  "postcode" | "borough",\n              )\n            }\n          >\n            <option value="postcode">\n              Postcode\n            </option>\n            <option value="borough">\n              Borough\n            </option>\n          </select>\n        </label>''',
    '''        <fieldset className="le-search-mode">\n          <legend>Search by</legend>\n          <label>\n            <input\n              type="radio"\n              name="searchMode"\n              value="postcode"\n              checked={searchMode === "postcode"}\n              onChange={() =>\n                setSearchMode("postcode")\n              }\n            />\n            <span>Postcode</span>\n          </label>\n          <label>\n            <input\n              type="radio"\n              name="searchMode"\n              value="borough"\n              checked={searchMode === "borough"}\n              onChange={() =>\n                setSearchMode("borough")\n              }\n            />\n            <span>Borough</span>\n          </label>\n        </fieldset>''',
)

replace_once(
    view,
    '''            <label>\n              <span>UK postcode</span>\n              <input''',
    '''            <label>\n              <span>Postcode</span>\n              <input''',
)

replace_once(
    view,
    '''            <label>\n              <span>Radius</span>\n              <select\n                value={radiusMiles}\n                onChange={(event) =>\n                  setRadiusMiles(\n                    event.target.value,\n                  )\n                }\n              >\n                {[1, 2, 3, 5, 10, 15, 20, 30]\n                  .map((value) => (\n                    <option\n                      key={value}\n                      value={value}\n                    >\n                      {value} miles\n                    </option>\n                  ))}\n              </select>\n            </label>''',
    '''            <label>\n              <span>Radius</span>\n              <div className="le-radius-control">\n                <select\n                  value={radiusMiles}\n                  onChange={(event) =>\n                    setRadiusMiles(\n                      event.target.value,\n                    )\n                  }\n                >\n                  {[1, 2, 3, 5, 10, 15, 20, 30]\n                    .map((value) => (\n                      <option\n                        key={value}\n                        value={value}\n                      >\n                        {value}\n                      </option>\n                    ))}\n                </select>\n                <span>miles</span>\n              </div>\n            </label>''',
)

replace_once(
    view,
    '''                  {item.label}\n                </option>''',
    '''                  {item.value ===\n                  ALL_LEAD_SECTORS\n                    ? "All sectors"\n                    : item.label}\n                </option>''',
)

replace_once(
    view,
    '''          className="le-primary"\n          disabled={searching}\n        >\n          {searching\n            ? "Searching…"\n            : "Search businesses"}''',
    '''          className="le-primary le-discovery-search-button"\n          disabled={searching}\n        >\n          {searching\n            ? "Searching…"\n            : "Search area →"}''',
)

old_toolbar = '''          <div className="le-results-toolbar">\n            <div className="le-view-filters">\n              <button\n                type="button"\n                className={\n                  resultFilter === "all"\n                    ? "is-active"\n                    : ""\n                }\n                onClick={() =>\n                  setResultFilter("all")\n                }\n              >\n                All ({results.length})\n              </button>\n              <button\n                type="button"\n                className={\n                  resultFilter === "unseen"\n                    ? "is-active"\n                    : ""\n                }\n                onClick={() =>\n                  setResultFilter("unseen")\n                }\n              >\n                Unseen ({unseenCount})\n              </button>\n              <button\n                type="button"\n                className={\n                  resultFilter === "seen"\n                    ? "is-active"\n                    : ""\n                }\n                onClick={() =>\n                  setResultFilter("seen")\n                }\n              >\n                Seen ({results.length - unseenCount})\n              </button>\n            </div>\n            <span\n              className="le-google-attribution"\n              translate="no"\n            >\n              Google Maps\n            </span>\n          </div>'''
new_toolbar = '''          <div className="le-discovery-results-heading">\n            <div className="le-discovery-results-copy">\n              <p className="le-overline">\n                SEARCH RESULTS\n              </p>\n              <h3>A sharper local shortlist</h3>\n            </div>\n            <div className="le-discovery-results-actions">\n              <div className="le-view-filters">\n                <button\n                  type="button"\n                  className={\n                    resultFilter === "all"\n                      ? "is-active"\n                      : ""\n                  }\n                  onClick={() =>\n                    setResultFilter("all")\n                  }\n                >\n                  All <strong>{results.length}</strong>\n                </button>\n                <button\n                  type="button"\n                  className={\n                    resultFilter === "unseen"\n                      ? "is-active"\n                      : ""\n                  }\n                  onClick={() =>\n                    setResultFilter("unseen")\n                  }\n                >\n                  Unseen <strong>{unseenCount}</strong>\n                </button>\n                <button\n                  type="button"\n                  className={\n                    resultFilter === "seen"\n                      ? "is-active"\n                      : ""\n                  }\n                  onClick={() =>\n                    setResultFilter("seen")\n                  }\n                >\n                  Seen <strong>{results.length - unseenCount}</strong>\n                </button>\n              </div>\n              {exportEnabled &&\n                onExportCsv !== undefined && (\n                  <button\n                    type="button"\n                    className="le-founder-export-inline"\n                    disabled={exporting}\n                    onClick={onExportCsv}\n                  >\n                    {exporting\n                      ? "Preparing CSV…"\n                      : "Founder Download CSV ↓"}\n                  </button>\n                )}\n            </div>\n          </div>'''
replace_once(view, old_toolbar, new_toolbar)

replace_once(
    view,
    '''                return (\n                  <article''',
    '''                const cardSector =\n                  row.prospect?.sector ??\n                  (sector === ALL_LEAD_SECTORS\n                    ? null\n                    : sector);\n                return (\n                  <article''',
)

replace_once(
    view,
    '''                    <div className="le-result-top">\n                      <div>\n                        {row.viewState ===\n                          "unseen" && (\n                            <span className="le-new-badge">\n                              NEW\n                            </span>\n                          )}\n                        <h3>\n                          {row.result.businessName}\n                        </h3>\n                      </div>''',
    '''                    <div className="le-result-top">\n                      <div>\n                        <div className="le-result-kicker">\n                          <span className="le-result-sector">\n                            {compactSectorLabel(\n                              cardSector,\n                            )}\n                          </span>\n                          {row.viewState ===\n                            "unseen" && (\n                              <span className="le-new-badge">\n                                NEW\n                              </span>\n                            )}\n                        </div>\n                        <h3>\n                          {row.result.businessName}\n                        </h3>\n                      </div>''',
)

replace_once(
    view,
    '''            </div>\n          )}\n        </div>\n      )}\n\n      <details className="le-founder-utility">''',
    '''            </div>\n          )}\n          <span\n            className="le-google-attribution le-discovery-attribution"\n            translate="no"\n          >\n            Google Maps\n          </span>\n        </div>\n      )}\n\n      <details className="le-founder-utility">''',
)

replace_once(
    engine,
    '''          <div className="le-header-tools">\n            {exportEnabled && (\n              <button\n                type="button"\n                className="le-header-button"\n                disabled={exporting}\n                onClick={() =>\n                  void exportCsv()\n                }\n              >\n                {exporting\n                  ? "Preparing CSV…"\n                  : "Download CSV"}\n              </button>\n            )}\n            <button''',
    '''          <div className="le-header-tools">\n            <button''',
)

replace_once(
    engine,
    '''            onOpenProspect={\n              (prospectId, ready) =>\n                void openProspect(\n                  prospectId,\n                  ready,\n                )\n            }\n            onMessage={showMessage}''',
    '''            onOpenProspect={\n              (prospectId, ready) =>\n                void openProspect(\n                  prospectId,\n                  ready,\n                )\n            }\n            exportEnabled={exportEnabled}\n            exporting={exporting}\n            onExportCsv={() =>\n              void exportCsv()\n            }\n            onMessage={showMessage}''',
)

print("Find Prospects Figma patch applied")
