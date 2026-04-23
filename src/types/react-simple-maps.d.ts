declare module 'react-simple-maps' {
  import { ReactNode, SVGProps, MouseEventHandler } from 'react'

  interface ProjectionConfig {
    scale?: number
    center?: [number, number]
    parallels?: [number, number]
    rotate?: [number, number, number]
  }

  interface ComposableMapProps {
    projection?: string
    projectionConfig?: ProjectionConfig
    width?: number
    height?: number
    style?: React.CSSProperties
    className?: string
    children?: ReactNode
  }

  interface GeoFeature {
    rsmKey: string
    type: string
    properties: Record<string, unknown>
    geometry: unknown
  }

  interface GeographiesChildrenProps {
    geographies: GeoFeature[]
  }

  interface GeographiesProps {
    geography: string | object
    children: (props: GeographiesChildrenProps) => ReactNode
  }

  interface GeographyProps extends SVGProps<SVGPathElement> {
    geography: GeoFeature
    fill?: string
    stroke?: string
    strokeWidth?: number
    style?: React.CSSProperties | { default?: React.CSSProperties; hover?: React.CSSProperties; pressed?: React.CSSProperties }
    className?: string
  }

  interface MarkerProps {
    coordinates: [number, number]
    children?: ReactNode
    onMouseEnter?: MouseEventHandler<SVGGElement>
    onMouseLeave?: MouseEventHandler<SVGGElement>
    onClick?: MouseEventHandler<SVGGElement>
    className?: string
    style?: React.CSSProperties
  }

  export function ComposableMap(props: ComposableMapProps): JSX.Element
  export function Geographies(props: GeographiesProps): JSX.Element
  export function Geography(props: GeographyProps): JSX.Element
  export function Marker(props: MarkerProps): JSX.Element
  export function ZoomableGroup(props: { center?: [number, number]; zoom?: number; children?: ReactNode }): JSX.Element
  export function Sphere(props: SVGProps<SVGPathElement>): JSX.Element
  export function Graticule(props: SVGProps<SVGPathElement>): JSX.Element
}
