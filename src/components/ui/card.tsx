import React from "react";

export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`card ${props.className ?? ""}`} />;
}
export function CardHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`card-header ${props.className ?? ""}`} />;
}
export function CardTitle(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`card-title ${props.className ?? ""}`} />;
}
export function CardContent(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`card-content ${props.className ?? ""}`} />;
}
