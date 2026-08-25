// @generated-from: packages/catalog/catalog-sources.json
// @generated-content-sha256: sha256:2a93665cf8512274de5d182db5ddb406a6de82bf15b6241e4be7ee3dc7c28e49
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
    readonly "pending"?: boolean;
  };
  readonly events: {
    readonly "activate": CustomEvent<void>;
  };
  readonly slots: "root" | "label";
}
