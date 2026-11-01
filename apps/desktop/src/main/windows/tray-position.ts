export interface WindowRectangle {
  readonly width: number
  readonly height: number
}

export interface WorkArea extends WindowRectangle {
  readonly x: number
  readonly y: number
}

export interface WindowPosition {
  readonly x: number
  readonly y: number
}

export function getTrayPosition(workArea: WorkArea, windowSize: WindowRectangle): WindowPosition {
  return {
    x: workArea.x + workArea.width - windowSize.width,
    y: workArea.y + workArea.height - windowSize.height,
  }
}
