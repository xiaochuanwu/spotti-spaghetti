export const AppShell = ({ inspector, main, sidebar }) => (
  <div className="mx-auto grid w-full max-w-[1600px] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[252px_minmax(0,1fr)_340px] 2xl:grid-cols-[268px_minmax(0,1fr)_360px]">
    <aside className="order-1 min-w-0 lg:col-span-2 xl:sticky xl:top-16 xl:col-span-1">
      {sidebar}
    </aside>

    <section className="order-3 min-w-0 lg:order-2 xl:order-2">
      {main}
    </section>

    <aside className="order-2 min-w-0 lg:sticky lg:top-16 lg:col-start-2 lg:order-3 xl:col-start-auto">
      {inspector}
    </aside>
  </div>
);
