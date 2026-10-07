<script lang="ts">
  let {
    label,
    value,
    min,
    max,
    step = 0.001,
    unit = '',
    onChange,
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    onChange: (value: number) => void;
  } = $props();
  const id = $props.id();
</script>

<div class="slider-control">
  <div class="control-label">
    <label for={id}>{label}</label><output for={id}>{Number(value.toFixed(3))}{unit}</output>
  </div>
  <input
    {id}
    type="range"
    {min}
    {max}
    {step}
    {value}
    oninput={(event) => onChange(event.currentTarget.valueAsNumber)}
  />
</div>
