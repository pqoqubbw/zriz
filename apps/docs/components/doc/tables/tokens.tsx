import { Fragment } from "react";

type TokensProps = {
  items: readonly string[];
};

const Tokens = ({ items }: TokensProps) =>
  items.map((item, i) => (
    <Fragment key={`${i}-${item}`}>
      {i > 0 && " "}
      <span>{item}</span>
    </Fragment>
  ));

export { Tokens };
