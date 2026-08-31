// @generated-from: packages/catalog/catalog-sources.json
// @generated-content-sha256: sha256:1960c117ccc4dad28807830605cf85fc3ee26eb9a9c3d382d62300dc27e68345
export interface ButtonWebHtmlBinding {
  readonly bindingRef: "muxui:component:button#web.html";
  readonly props: {
    readonly "disabled"?: boolean;
  };
  readonly events: {
    readonly "activate": CustomEvent<void>;
  };
  readonly slots: "root" | "label";
}

export interface ButtonWebReactBinding {
  readonly bindingRef: "muxui:component:button#web.react";
  readonly props: {
    readonly "disabled"?: boolean;
    readonly "pending"?: boolean;
  };
  readonly events: {
    readonly "activate": CustomEvent<void>;
  };
  readonly slots: "root" | "label";
}
