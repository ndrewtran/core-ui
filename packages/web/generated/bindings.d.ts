// @generated-from: packages/catalog/catalog-sources.json
// @generated-content-sha256: sha256:636e5d1e8b3929b5d97bc5cf82b6c6f60a3211d89bc126501be5293c9456fed7
export interface ButtonWebHtmlBinding {
  readonly bindingRef: "core:component:button#web.html";
  readonly props: {
    readonly "disabled"?: boolean;
  };
  readonly events: {
    readonly "activate": CustomEvent<void>;
  };
  readonly slots: "root" | "label";
}

export interface ButtonWebReactBinding {
  readonly bindingRef: "core:component:button#web.react";
  readonly props: {
    readonly "disabled"?: boolean;
  };
  readonly events: {
    readonly "activate": CustomEvent<void>;
  };
  readonly slots: "root" | "label";
}
